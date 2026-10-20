-- Rollback for 0002_a1_security_closeout.sql.
-- Restores migration 0001's deletion function (row-deleting; note that
-- version did NOT remove the Auth user — see 0001), the permissive
-- player_progress policy, and drops the CAS RPC + pending column.

-- ── Restore 0001 deletion function ──────────────────────────────────────────
drop function if exists public.request_account_deletion();

create function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  insert into public.audit_events (user_id, kind, detail)
  values (v_user, 'account-deletion-requested', '{}'::jsonb);
  delete from public.player_progress   where user_id = v_user;
  delete from public.guest_migrations  where user_id = v_user;
  delete from public.fighter_ownership where user_id = v_user;
  delete from public.wallet_ledger     where user_id = v_user;
  delete from public.wallets           where user_id = v_user;
  delete from public.account_roles     where user_id = v_user;
  delete from public.profiles          where id = v_user;
end;
$$;

revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;

alter table public.profiles
  drop column if exists deletion_requested_at;

-- ── Remove CAS + restore 0001 player_progress policy ────────────────────────
drop function if exists public.save_progress_snapshot_cas(text, integer, jsonb);

drop policy if exists player_progress_self_select on public.player_progress;
drop policy if exists player_progress_self_all on public.player_progress;
create policy player_progress_self_all on public.player_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
