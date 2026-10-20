-- A1.2: one pending-review guest lineage record per signed-in user and device guest ID.
-- Prevent duplicate records when Supabase Magic Links open multiple game tabs.
-- This index does NOT validate local economic claims or award server currency.
create unique index if not exists guest_migrations_user_guest_unique
  on public.guest_migrations (user_id, guest_profile_id);
