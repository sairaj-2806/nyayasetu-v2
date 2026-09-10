-- ============================================================================
-- MIGRATION: 20260910220000_harden_asset_state_machine_and_rls.sql
-- DESCRIPTION: Enforces authoritative state-machine transitions and RLS hardening
--              for police assets and evidence under BSA 2023 & MHA guidelines.
-- ============================================================================

-- 1. STATE MACHINE TRANSITION TRIGGER FUNCTION FOR POLICE ASSETS
CREATE OR REPLACE FUNCTION public.enforce_police_asset_lifecycle_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_is_custodian BOOLEAN;
BEGIN
  -- Verify caller privileges via Supabase Auth
  v_is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  v_is_custodian := public.check_user_permission(auth.uid(), 'EVIDENCE_CUSTODY') 
                    OR public.check_user_permission(auth.uid(), 'ASSET_MAINTENANCE');

  -- Immutability check: asset_code and id can NEVER be changed
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Security Violation: Asset primary key ID is immutable.';
  END IF;

  IF NEW.asset_code <> OLD.asset_code THEN
    RAISE EXCEPTION 'Security Violation: Asset tracking code "%" is immutable.', OLD.asset_code;
  END IF;

  -- Lifecycle Status Transitions Enforcement
  IF OLD.status <> NEW.status THEN
    -- Transition TO 'RETIRED' requires Administrator authorization
    IF NEW.status = 'RETIRED' AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Authorization Violation: Decommissioning an asset to RETIRED requires Administrator authority.';
    END IF;

    -- Transition TO 'LOST' requires Administrator authorization
    IF NEW.status = 'LOST' AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Authorization Violation: Declaring an asset or evidence exhibit as LOST requires Administrator authority.';
    END IF;

    -- Transition FROM 'RETIRED' (Reactivation) strictly requires Administrator authorization
    IF OLD.status = 'RETIRED' AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Authorization Violation: Reactivating a RETIRED asset requires Administrator authority.';
    END IF;

    -- Transition FROM 'LOST' (Recovery) requires Administrator or Evidence Custodian authorization
    IF OLD.status = 'LOST' AND NOT (v_is_admin OR v_is_custodian) THEN
      RAISE EXCEPTION 'Authorization Violation: Recovering an item from LOST status requires Custodian or Administrator authority.';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- 2. BIND TRIGGER TO PUBLIC.POLICE_ASSETS
DROP TRIGGER IF EXISTS trg_enforce_police_asset_lifecycle ON public.police_assets;

CREATE TRIGGER trg_enforce_police_asset_lifecycle
  BEFORE UPDATE ON public.police_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_police_asset_lifecycle_transitions();

-- 3. HARDEN POLICE_ASSETS RLS POLICIES
DROP POLICY IF EXISTS "Hardened update police assets" ON public.police_assets;

CREATE POLICY "Hardened update police assets" ON public.police_assets
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.check_user_permission(auth.uid(), 'ASSET_ASSIGN')
    OR public.check_user_permission(auth.uid(), 'ASSET_TRANSFER')
    OR public.check_user_permission(auth.uid(), 'ASSET_MAINTENANCE')
    OR public.check_user_permission(auth.uid(), 'EVIDENCE_CUSTODY')
  )
  WITH CHECK (
    -- Direct REST callers cannot transition to/from RETIRED or LOST without admin
    CASE 
      WHEN status IN ('RETIRED'::public.asset_lifecycle_status, 'LOST'::public.asset_lifecycle_status) THEN
        public.has_role(auth.uid(), 'admin'::public.app_role)
      ELSE (
        public.check_user_permission(auth.uid(), 'ASSET_ASSIGN')
        OR public.check_user_permission(auth.uid(), 'ASSET_TRANSFER')
        OR public.check_user_permission(auth.uid(), 'ASSET_MAINTENANCE')
        OR public.check_user_permission(auth.uid(), 'EVIDENCE_CUSTODY')
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
    END
  );

-- 4. HARDEN PUBLIC.CASE_DOCUMENTS RLS SELECT POLICY
-- Disallow unassigned users from selecting restricted records via REST
DROP POLICY IF EXISTS "Allow authenticated read case documents" ON public.case_documents;

CREATE POLICY "Allow authenticated read case documents" ON public.case_documents
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR sensitivity_tier = 'PUBLIC'::public.document_sensitivity_tier
    OR (
      -- Restricted investigation files: IO, FSL, Registrar, or Bench
      sensitivity_tier = 'RESTRICTED'::public.document_sensitivity_tier
      AND (
        public.check_user_permission(auth.uid(), 'DOCUMENT_VIEW')
        AND NOT public.has_role(auth.uid(), 'police_officer'::public.app_role)
      )
    )
    OR (
      -- Sealed Cover: Judges only
      sensitivity_tier = 'SEALED_COVER_IN_CAMERA'::public.document_sensitivity_tier
      AND public.has_role(auth.uid(), 'judge'::public.app_role)
    )
  );
