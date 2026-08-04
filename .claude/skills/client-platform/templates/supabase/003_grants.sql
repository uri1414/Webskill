-- ============================================================================
-- 003_grants.sql — table privileges.
--
-- RLS decides WHICH rows a role may see; GRANT decides whether the role may
-- touch the table at ALL. Both are required — a table with RLS policies but no
-- GRANT still throws "permission denied for table ...".
-- ============================================================================

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on all tables in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- anon (logged-out visitor) gets NOTHING at the foundation layer. Public /
-- anonymous intake (e.g. a consultation form) is added later as a single,
-- hardened INSERT-only grant + policy on exactly one table — never a blanket
-- grant. See references/foundation.md and Permission-System.md.
