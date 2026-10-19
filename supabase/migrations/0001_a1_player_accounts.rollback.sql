-- Rollback for 0001_a1_player_accounts.sql
-- Drops every A1 object. Data in these tables is destroyed; export first if
-- the project has real users.
begin;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.request_account_deletion();
drop function if exists public.buy_fighter(text, text);
drop function if exists public.lucky_draw(text);
drop function if exists public.claim_match_reward(text, text, text);
drop function if exists public.assert_cloud_wallet_enabled();

drop table if exists public.audit_events;
drop table if exists public.guest_migrations;
drop table if exists public.player_progress;
drop table if exists public.match_reward_claims;
drop table if exists public.fighter_ownership;
drop table if exists public.wallet_ledger;
drop table if exists public.wallets;
drop table if exists public.account_roles;
drop table if exists public.profiles;
drop table if exists public.app_config;

commit;
