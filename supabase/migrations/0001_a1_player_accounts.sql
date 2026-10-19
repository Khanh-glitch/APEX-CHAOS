-- A1 — Player Account, Economy & Fighter Experience (migration 0001)
--
-- Run in the Supabase SQL editor (or `supabase db push`) on the APEX CHAOS
-- project. Rollback: supabase/migrations/0001_a1_player_accounts.rollback.sql
--
-- TRUST BOUNDARY (read before enabling anything):
--   * Gameplay currently runs in the browser, so client-reported match
--     outcomes are NOT cheat-proof. The wallet RPCs below therefore ship
--     DISABLED via app_config.cloud_wallet_enabled = false and raise until
--     a future phase adds server-validated match receipts. Do not flip the
--     flag for a public build before that validation exists.
--   * The anon key + user JWT + RLS is the only client credential. Wallet,
--     ledger and ownership rows are writable ONLY through the
--     security-definer RPCs; account_roles is writable by nobody through
--     the API (grant admin with a manual SQL insert, see the bottom).

begin;

create table if not exists public.app_config (
  key   text primary key,
  value jsonb not null
);
insert into public.app_config (key, value)
values ('cloud_wallet_enabled', 'false'::jsonb)
on conflict (key) do nothing;

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.account_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('player', 'admin')),
  granted_by text,
  granted_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  credits    bigint not null default 350 check (credits >= 0),
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_ledger (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  delta           bigint not null,
  balance_after   bigint not null,
  kind            text not null,
  idempotency_key text not null unique,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists public.fighter_ownership (
  user_id     uuid not null references auth.users (id) on delete cascade,
  fighter_id  text not null,
  source      text not null check (source in ('starter', 'draw', 'shop', 'migration', 'grant')),
  acquired_at timestamptz not null default now(),
  primary key (user_id, fighter_id)
);

create table if not exists public.match_reward_claims (
  claim_key  text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  mode       text not null check (mode in ('BOT', 'LOCAL')),
  outcome    text not null check (outcome in ('P1', 'P2')),
  amount     bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.player_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  namespace  text not null,
  version    integer not null default 1,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, namespace)
);

create table if not exists public.guest_migrations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  guest_profile_id text not null,
  snapshot         jsonb not null default '{}'::jsonb,
  status           text not null default 'pending-review'
                   check (status in ('pending-review', 'applied', 'rejected')),
  created_at       timestamptz not null default now()
);

create table if not exists public.audit_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  kind       text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.account_roles     enable row level security;
alter table public.wallets           enable row level security;
alter table public.wallet_ledger     enable row level security;
alter table public.fighter_ownership enable row level security;
alter table public.match_reward_claims enable row level security;
alter table public.player_progress   enable row level security;
alter table public.guest_migrations  enable row level security;
alter table public.audit_events      enable row level security;
alter table public.app_config        enable row level security;

-- Profiles: owner reads/updates own row.
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Roles: owner may READ own role (the client needs it to gate Admin UI).
-- No insert/update/delete policy exists: roles are granted only via SQL.
create policy account_roles_self_select on public.account_roles
  for select using (user_id = auth.uid());

-- Wallet + ledger + ownership + claims: owner READ-ONLY through the API.
-- All writes go through the security-definer RPCs below.
create policy wallets_self_select on public.wallets
  for select using (user_id = auth.uid());
create policy wallet_ledger_self_select on public.wallet_ledger
  for select using (user_id = auth.uid());
create policy fighter_ownership_self_select on public.fighter_ownership
  for select using (user_id = auth.uid());
create policy match_reward_claims_self_select on public.match_reward_claims
  for select using (user_id = auth.uid());

-- Progress snapshots: owner read/write own rows (non-economic payloads and
-- explicitly-unverified snapshots; version column carries the conflict law).
create policy player_progress_self_all on public.player_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Guest migrations: owner may insert + read own records; promotion to
-- verified assets is an operator/server decision, never a client update.
create policy guest_migrations_self_insert on public.guest_migrations
  for insert with check (user_id = auth.uid());
create policy guest_migrations_self_select on public.guest_migrations
  for select using (user_id = auth.uid());

-- Audit events: not readable through the API.
-- app_config: not readable through the API (RPCs read it as definer).

-- ── New-account bootstrap: profile + 350 AC wallet + ROBOT ownership ───────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id, credits)
  values (new.id, 350)
  on conflict (user_id) do nothing;

  insert into public.wallet_ledger (user_id, delta, balance_after, kind, idempotency_key)
  values (new.id, 350, 350, 'starter-grant', 'starter:' || new.id::text)
  on conflict (idempotency_key) do nothing;

  insert into public.fighter_ownership (user_id, fighter_id, source)
  values (new.id, 'ROBOT', 'starter')
  on conflict (user_id, fighter_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Wallet RPCs (security definer; DISABLED until receipts exist) ───────────
create or replace function public.assert_cloud_wallet_enabled()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((select (value)::text from public.app_config where key = 'cloud_wallet_enabled'), 'false') <> 'true' then
    raise exception 'cloud wallet issuance is disabled pending validated match receipts';
  end if;
end;
$$;

-- A1 reward law, computed SERVER-SIDE from (mode, outcome) only:
-- BOT P1 win 100 · BOT loss 25 (provisional) · LOCAL completion 50 either way.
create or replace function public.claim_match_reward(p_claim_key text, p_mode text, p_outcome text)
returns table (amount bigint, balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_amount bigint;
  v_balance bigint;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  perform public.assert_cloud_wallet_enabled();
  if p_mode not in ('BOT', 'LOCAL') or p_outcome not in ('P1', 'P2') then
    raise exception 'invalid mode/outcome';
  end if;
  v_amount := case
    when p_mode = 'BOT' and p_outcome = 'P1' then 100
    when p_mode = 'BOT' then 25
    else 50
  end;

  insert into public.match_reward_claims (claim_key, user_id, mode, outcome, amount)
  values (p_claim_key, v_user, p_mode, p_outcome, v_amount)
  on conflict (claim_key) do nothing;
  if not found then
    -- Idempotent replay: return the original claim without moving money.
    select c.amount into v_amount from public.match_reward_claims c where c.claim_key = p_claim_key;
    select w.credits into v_balance from public.wallets w where w.user_id = v_user;
    return query select v_amount, v_balance;
    return;
  end if;

  update public.wallets
     set credits = credits + v_amount, version = version + 1, updated_at = now()
   where user_id = v_user
  returning credits into v_balance;

  insert into public.wallet_ledger (user_id, delta, balance_after, kind, idempotency_key, meta)
  values (v_user, v_amount, v_balance, 'match-reward', 'claim:' || p_claim_key,
          jsonb_build_object('mode', p_mode, 'outcome', p_outcome));

  return query select v_amount, v_balance;
end;
$$;

-- Atomic Lucky Draw: deduct 350 and grant one unowned playable fighter, or
-- roll back entirely. The playable list mirrors PRODUCT_ROSTER.playableIds
-- in src/game/productSurface.js — keep them in sync when the roster grows.
create or replace function public.lucky_draw(p_idempotency_key text)
returns table (fighter_id text, balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_playable text[] := array['ROBOT','HUNTER','CRYSTAL','MAGNET','ICE','MIRROR','BOXE','SHURI'];
  v_pick text;
  v_balance bigint;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  perform public.assert_cloud_wallet_enabled();

  if exists (select 1 from public.wallet_ledger where idempotency_key = 'draw:' || p_idempotency_key) then
    select meta ->> 'fighter' into v_pick from public.wallet_ledger
     where idempotency_key = 'draw:' || p_idempotency_key;
    select credits into v_balance from public.wallets where user_id = v_user;
    return query select v_pick, v_balance;
    return;
  end if;

  select f into v_pick
    from unnest(v_playable) as f
   where not exists (
     select 1 from public.fighter_ownership o
      where o.user_id = v_user and o.fighter_id = f)
   order by random()
   limit 1;
  if v_pick is null then raise exception 'roster complete'; end if;

  update public.wallets
     set credits = credits - 350, version = version + 1, updated_at = now()
   where user_id = v_user and credits >= 350
  returning credits into v_balance;
  if v_balance is null then raise exception 'insufficient credits'; end if;

  insert into public.fighter_ownership (user_id, fighter_id, source)
  values (v_user, v_pick, 'draw');

  insert into public.wallet_ledger (user_id, delta, balance_after, kind, idempotency_key, meta)
  values (v_user, -350, v_balance, 'lucky-draw', 'draw:' || p_idempotency_key,
          jsonb_build_object('fighter', v_pick));

  return query select v_pick, v_balance;
end;
$$;

create or replace function public.buy_fighter(p_fighter_id text, p_idempotency_key text)
returns table (fighter_id text, balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_playable text[] := array['ROBOT','HUNTER','CRYSTAL','MAGNET','ICE','MIRROR','BOXE','SHURI'];
  v_balance bigint;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  perform public.assert_cloud_wallet_enabled();
  if not (p_fighter_id = any (v_playable)) then raise exception 'unavailable'; end if;
  if exists (select 1 from public.fighter_ownership
              where user_id = v_user and fighter_id = p_fighter_id) then
    raise exception 'already owned';
  end if;

  update public.wallets
     set credits = credits - 1000, version = version + 1, updated_at = now()
   where user_id = v_user and credits >= 1000
  returning credits into v_balance;
  if v_balance is null then raise exception 'insufficient credits'; end if;

  insert into public.fighter_ownership (user_id, fighter_id, source)
  values (v_user, p_fighter_id, 'shop');

  insert into public.wallet_ledger (user_id, delta, balance_after, kind, idempotency_key, meta)
  values (v_user, -1000, v_balance, 'fighter-shop', 'buy:' || p_idempotency_key,
          jsonb_build_object('fighter', p_fighter_id));

  return query select p_fighter_id, v_balance;
end;
$$;

-- Account deletion (client call): removes the caller's public data and
-- audits the request. Removing the underlying auth.users row requires a
-- service-role sweep: `delete from auth.users where id in (select user_id
-- from audit_events where kind='account-deletion-requested')` — or enable
-- Supabase's scheduled cleanup. The local device guest is unaffected.
create or replace function public.request_account_deletion()
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

revoke all on function public.claim_match_reward(text, text, text) from public;
revoke all on function public.lucky_draw(text) from public;
revoke all on function public.buy_fighter(text, text) from public;
revoke all on function public.request_account_deletion() from public;
grant execute on function public.claim_match_reward(text, text, text) to authenticated;
grant execute on function public.lucky_draw(text) to authenticated;
grant execute on function public.buy_fighter(text, text) to authenticated;
grant execute on function public.request_account_deletion() to authenticated;

commit;

-- ── Operator: grant the owner the admin role (run manually, once) ──────────
-- insert into public.account_roles (user_id, role, granted_by)
-- values ('<owner-auth-user-uuid>', 'admin', 'operator-sql')
-- on conflict (user_id) do update set role = 'admin';
