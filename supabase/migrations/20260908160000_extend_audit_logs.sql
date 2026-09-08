-- Migration: Extend audit_logs architecture for Secure DMS, Police Assets, and Malkhana Evidence
-- Timestamp: 2026-09-08T16:00:00.000Z
-- Purpose:
-- 1. Reuses the existing public.audit_logs architecture without duplicate audit tables.
-- 2. Ensures RLS policies on audit_logs restrict viewing to users with AUDIT_VIEW permission
--    (Admins, Registrars, Investigating Officers, Forensic Officers, Evidence Custodians).
-- 3. Guarantees audit append integrity: no update or delete is permitted on audit records.

-- A. Performance indexes on audit_logs for high-volume querying and date filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp_desc ON public.audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);

-- B. Harden RLS on public.audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Read policy: Only authorized staff roles may inspect the accountability trail
DROP POLICY IF EXISTS "Authorized roles can read audit logs" ON public.audit_logs;
CREATE POLICY "Authorized roles can read audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.user_id = auth.uid()
        AND sp.role IN ('admin', 'registrar', 'investigating_officer', 'forensic_officer', 'evidence_custodian')
    )
  );

-- Insert policy: Authenticated staff can write audit log entries
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Immutable enforcement: Strictly prevent UPDATE and DELETE on audit logs
DROP POLICY IF EXISTS "No updates on audit logs" ON public.audit_logs;
CREATE POLICY "No updates on audit logs"
  ON public.audit_logs
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "No deletes on audit logs" ON public.audit_logs;
CREATE POLICY "No deletes on audit logs"
  ON public.audit_logs
  FOR DELETE
  TO authenticated
  USING (false);

-- C. Documentation Comment
COMMENT ON TABLE public.audit_logs IS
  'Universal immutable audit ledger for NyayaSetu. Records judicial scheduling decisions, Secure DMS lifecycle events, Police Asset allocations, and Malkhana Evidence Chain of Custody transfers.';
