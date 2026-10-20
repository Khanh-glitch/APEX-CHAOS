-- APEX CHAOS — A1 security closeout (migration 0002, builds on 0001).
--
-- Addresses the independent security review of PR #97:
--
-- Blocker 2 — cloud sync lost concurrent writes. Migration 0001 let the
-- client read player_progress.version and then upsert unconditionally, so
-- two signed-in devices silently overwrote each other. This migration:
--   * adds `save_progress_snapshot_cas`, an ATOMIC compare-and-swap RPC
--     (single conditional UPDATE / insert-if-absent, caller bound to
--     auth.uid()). A version mismatch returns ok=false and changes
--     nothing — the newer server snapshot is preserved.
--   * revokes direct table writes on player_progress (self-SELECT only),
--     so the CAS cannot be bypassed through PostgREST table access.
--
-- Blocker 3 — account deletion semantics. 0001's request_account_deletion
-- deleted the caller's public rows but could NOT remove the Supabase Auth
-- user, so calling it "deletion" was false: the identity survived and a
-- fresh sign-in would recreate a profile. This migration converts it to an
-- honest REQUEST: it stamps profiles.deletion_requested_at, audits the
-- request, deletes nothing, and returns status 'pending'. A complete
-- erasure requires a service-role backend job that calls
-- auth.admin.deleteUser(userId) for profiles with deletion_requested_at
-- set (every public row cascades from auth.users). Until that job is
-- provisioned and tested, the product must display PENDING, never
-- success-as-deleted.
--
-- Like 0001 this file is authored but NOT executed against any hosted
-- project yet; run 0001 first, then this file, in the Supabase SQL editor
-- (see docs/a1/A1_SECURITY_CLOSEOUT.md). Safe to re-run.

-- ── Blocker 3: honest deletion-request semantics ────────────────────────────
alter table public.profiles
  add column if not exists deletion_requested_at timestamptz;

-- Return-type change (void -> table) requires dropping the 0001 function.
drop function if exists public.request_account_deletion();

create function public.request_account_deletion()
returns table(status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  -- Record the request only. No rows are deleted here: the account remains
  -- fully functional (and sign-in possible) until a service-role backend
  -- job removes the auth user. Stamp only once so repeated requests are
  -- idempotent and keep the original request time.
  update public.profiles
     set deletion_requested_at = coalesce(deletion_requested_at, now()),
         updated_at = now()
   where id = v_user;
  insert into public.audit_events (user_id, kind, detail)
  values (v_user, 'account-deletion-requested', '{"status":"pending"}'::jsonb);
  return query select 'pending'::text;
end;
$$;

revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;

comment on function public.request_account_deletion() is
  'Records a deletion REQUEST (status pending). Deletes nothing. Completion requires a service-role job calling auth.admin.deleteUser; profiles.deletion_requested_at marks the queue.';

-- ── Blocker 2: atomic compare-and-swap progress snapshots ───────────────────
create or replace function public.save_progress_snapshot_cas(
  p_namespace        text,
  p_expected_version integer,
  p_payload          jsonb
)
returns table(ok boolean, current_version integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_new  integer;
  v_cur  integer;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_namespace is null or length(p_namespace) = 0 then
    raise exception 'namespace required';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'invalid expected version';
  end if;

  if p_expected_version = 0 then
    -- First save: insert wins only if the row does not exist yet. A
    -- concurrent first save from another device conflicts into the ELSE
    -- path below and reports the winner's version.
    insert into public.player_progress (user_id, namespace, version, payload, updated_at)
    values (v_user, p_namespace, 1, coalesce(p_payload, '{}'::jsonb), now())
    on conflict (user_id, namespace) do nothing
    returning version into v_new;
    if v_new is not null then
      return query select true, v_new;
      return;
    end if;
  else
    -- Atomic compare-and-swap: the row updates only while its version is
    -- still the version the caller last saw. Two concurrent callers with
    -- the same expectation cannot both win; the loser matches zero rows.
    update public.player_progress
       set version = version + 1,
           payload = coalesce(p_payload, '{}'::jsonb),
           updated_at = now()
     where user_id = v_user
       and namespace = p_namespace
       and version = p_expected_version
    returning version into v_new;
    if v_new is not null then
      return query select true, v_new;
      return;
    end if;
  end if;

  -- Conflict: report the newer server version, change nothing.
  select version into v_cur
    from public.player_progress
   where user_id = v_user and namespace = p_namespace;
  return query select false, coalesce(v_cur, 0);
end;
$$;

revoke all on function public.save_progress_snapshot_cas(text, integer, jsonb) from public;
grant execute on function public.save_progress_snapshot_cas(text, integer, jsonb) to authenticated;

comment on function public.save_progress_snapshot_cas(text, integer, jsonb) is
  'Atomic compare-and-swap snapshot save for the caller (auth.uid()). ok=false means a newer snapshot exists and nothing was written.';

-- Writes must flow through the CAS RPC; direct table mutation is closed.
drop policy if exists player_progress_self_all on public.player_progress;
drop policy if exists player_progress_self_select on public.player_progress;
create policy player_progress_self_select on public.player_progress
  for select using (user_id = auth.uid());
