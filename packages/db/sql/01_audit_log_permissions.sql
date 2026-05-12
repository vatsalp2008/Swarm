-- ============================================================================
-- ADR-0005: audit_log is INSERT-only.
--
-- Apply AFTER `pnpm db:migrate` has created the audit_log table.
-- Idempotent. Safe to re-run.
--
-- Strategy:
--   1. Create a dedicated role `swarm_app` that the application connects as.
--      (Or, if you're using Supabase's `authenticated` / service_role flow,
--       adapt the GRANT/REVOKE targets accordingly — see notes below.)
--   2. Grant INSERT only on audit_log. Revoke UPDATE/DELETE.
--   3. Create a row-level constraint trigger that rejects any UPDATE or DELETE
--      attempt at the trigger layer, as defense-in-depth even if a future
--      migration accidentally re-grants those permissions.
--
-- For Supabase: the app connects via `authenticated` or `service_role`.
-- The service_role bypasses RLS, so we enforce at the trigger layer as well.
-- ============================================================================

-- --- Trigger-level enforcement (works regardless of which role is connected) ---

CREATE OR REPLACE FUNCTION audit_log_block_modifications()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (ADR-0005); % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_block_modifications();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_block_modifications();

DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION audit_log_block_modifications();

-- --- Role-level enforcement (defense-in-depth) ---
-- Uncomment and adapt for your environment.
--
-- If you're using a dedicated app role:
--   REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM swarm_app;
--   GRANT INSERT, SELECT ON audit_log TO swarm_app;
--
-- If you're using Supabase's default roles:
--   REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM authenticated;
--   REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM anon;
--   -- service_role is a superuser-like role and cannot be REVOKEd from in
--   -- the same way; trigger-level enforcement above is the primary defense.

-- --- Index on (id) is implicit via primary key; the chain is read in id order. ---

-- --- Sanity comment ---
COMMENT ON TABLE audit_log IS
  'Append-only hash-chained audit log (ADR-0005). UPDATE/DELETE/TRUNCATE blocked at trigger layer. Verify chain integrity via `pnpm verify:audit`.';
