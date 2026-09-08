-- ============================================================================
-- MIGRATION: 20260908170000_security_fixes_rls.sql
-- DESCRIPTION: Security hardening for Supabase Row Level Security:
--              1. Restrict police_assets lifecycle transitions to RETIRED and LOST
--                 strictly to administrators.
--              2. Prevent state-machine bypasses via direct REST API access.
-- COMPLIANCE: MHA Armory & Malkhana Guidelines, BSA 2023 §63
-- SAFETY: Non-destructive update to RLS policies.
-- ============================================================================

-- 1. HARDEN UPDATE POLICY ON POLICE_ASSETS
DROP POLICY IF EXISTS "Hardened update police assets" ON public.police_assets;

CREATE POLICY "Hardened update police assets" ON public.police_assets
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      -- Operational staff can update active assets
      public.check_user_permission(auth.uid(), 'ASSET_ASSIGN')
      OR public.check_user_permission(auth.uid(), 'ASSET_TRANSFER')
      OR public.check_user_permission(auth.uid(), 'ASSET_MAINTENANCE')
    )
  )
  WITH CHECK (
    -- If status is being set to RETIRED or LOST, caller MUST be administrator
    CASE 
      WHEN status IN ('RETIRED'::public.asset_lifecycle_status, 'LOST'::public.asset_lifecycle_status) THEN
        public.has_role(auth.uid(), 'admin'::public.app_role)
      ELSE (
        public.check_user_permission(auth.uid(), 'ASSET_ASSIGN')
        OR public.check_user_permission(auth.uid(), 'ASSET_TRANSFER')
        OR public.check_user_permission(auth.uid(), 'ASSET_MAINTENANCE')
      )
    END
  );
