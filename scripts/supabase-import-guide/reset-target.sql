-- =====================================================================
-- Reset target Supabase project before re-importing.
-- DESTRUCTIVE: drops all public objects and clears residual auth data.
-- Run this on the NEW project only.
-- =====================================================================

-- 1) Reset the public schema (your business tables + data)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL   ON SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- 2) Clear residual auth data (child rows first to respect FKs)
DELETE FROM auth.audit_log_entries;
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.mfa_amr_claims;
DELETE FROM auth.mfa_challenges;
DELETE FROM auth.mfa_factors;
DELETE FROM auth.sessions;
DELETE FROM auth.identities;
DELETE FROM auth.one_time_tokens;
DELETE FROM auth.flow_state;
DELETE FROM auth.users;
