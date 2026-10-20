-- A1 staging security hardening (applied to apex-chaos-staging on 2026-10-20).
-- Supabase/Postgres can grant EXECUTE to PUBLIC and anon on new functions by
-- default, even when prior migrations explicitly grant authenticated.
-- Ensure public RPCs cannot be called anonymously and expose only the five
-- intentional authenticated application operations.
--
-- Applies AFTER 0001_a1_player_accounts and 0002_a1_security_closeout.

revoke execute on all functions in schema public from PUBLIC, anon, authenticated;

grant execute on function public.claim_match_reward(text, text, text) to authenticated;
grant execute on function public.lucky_draw(text) to authenticated;
grant execute on function public.buy_fighter(text, text) to authenticated;
grant execute on function public.save_progress_snapshot_cas(text, integer, jsonb) to authenticated;
grant execute on function public.request_account_deletion() to authenticated;

-- public.handle_new_user() is a trigger entry, and
-- public.assert_cloud_wallet_enabled() is an internal wallet helper.
-- Neither requires client-callable EXECUTE.
alter default privileges for role postgres in schema public
  revoke execute on functions from PUBLIC, anon, authenticated;
