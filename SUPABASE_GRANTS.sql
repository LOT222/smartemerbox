-- Explicit Data API grants for Supabase public schema.
-- Run this after creating tables/functions, and keep it in future migrations.
--
-- Why:
-- New Supabase projects and future public tables require explicit GRANTs
-- before PostgREST, GraphQL, or supabase-js can access them.

grant usage on schema public to anon, authenticated, service_role;

-- Edge Functions in this project use SUPABASE_SERVICE_ROLE_KEY through supabase-js,
-- so service_role needs table, sequence, and function privileges for the Data API.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Login users are loaded through the Edge Function now, so this SECURITY DEFINER
-- fallback should not be callable directly from the browser.
do $$
begin
  if to_regprocedure('public.public_login_users()') is not null then
    revoke execute on function public.public_login_users() from public;
    revoke execute on function public.public_login_users() from anon, authenticated;
  end if;
end $$;

-- Future objects created by postgres in public should also be available to service_role.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
