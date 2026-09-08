-- ============================================================================
-- MIGRATION: 20260908150000_harden_rbac_dms_assets_evidence.sql
-- DESCRIPTION: Hardened Role-Based Access Control (RBAC) & PostgreSQL Row Level
--              Security (RLS) policies for Secure DMS, Police Assets, and Evidence.
-- COMPLIANCE: Bharatiya Sakshya Adhiniyam (BSA, 2023), MHA Malkhana Manual,
--             High Court In-Camera / Sealed Cover Confidentiality Rules.
-- SAFETY: Fully backward compatible. Non-destructive update to RLS policies.
-- ============================================================================

-- 1. EXTEND APP_ROLE ENUM IF NOT ALREADY PRESENT
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'judge';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'investigating_officer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'forensic_officer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'evidence_custodian';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'police_officer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. HELPER FUNCTIONS FOR ROLE AND PERMISSION VALIDATION IN RLS
CREATE OR REPLACE FUNCTION public.get_user_app_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_any_staff_role(_user_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.check_user_permission(_user_id uuid, _required_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  -- Admin always possesses all permissions
  IF public.has_role(_user_id, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  SELECT role::text INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _role IS NULL THEN
    RETURN false;
  END IF;

  CASE _required_permission
    -- Document Permissions
    WHEN 'DOCUMENT_VIEW' THEN
      RETURN true;
    WHEN 'DOCUMENT_UPLOAD' THEN
      RETURN _role IN ('registrar', 'investigating_officer', 'forensic_officer', 'evidence_custodian');
    WHEN 'DOCUMENT_VERSION' THEN
      RETURN _role IN ('registrar', 'investigating_officer', 'forensic_officer');
    WHEN 'DOCUMENT_DOWNLOAD' THEN
      RETURN true;
    WHEN 'DOCUMENT_SIGN' THEN
      RETURN _role IN ('judge', 'registrar', 'investigating_officer', 'forensic_officer', 'evidence_custodian');

    -- Asset Permissions
    WHEN 'ASSET_VIEW' THEN
      RETURN true;
    WHEN 'ASSET_CREATE' THEN
      RETURN _role IN ('evidence_custodian');
    WHEN 'ASSET_ASSIGN' THEN
      RETURN _role IN ('evidence_custodian');
    WHEN 'ASSET_TRANSFER' THEN
      RETURN _role IN ('evidence_custodian', 'investigating_officer');
    WHEN 'ASSET_MAINTENANCE' THEN
      RETURN _role IN ('evidence_custodian', 'forensic_officer');

    -- Evidence Permissions
    WHEN 'EVIDENCE_VIEW' THEN
      RETURN true;
    WHEN 'EVIDENCE_TRANSFER' THEN
      RETURN _role IN ('evidence_custodian', 'investigating_officer', 'forensic_officer');
    WHEN 'EVIDENCE_CUSTODY' THEN
      RETURN _role IN ('evidence_custodian', 'investigating_officer', 'forensic_officer', 'registrar');

    -- Audit Permission
    WHEN 'AUDIT_VIEW' THEN
      RETURN _role IN ('registrar', 'investigating_officer', 'forensic_officer', 'evidence_custodian');

    ELSE
      RETURN false;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_app_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_app_role(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_any_staff_role(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_staff_role(uuid, text[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_user_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_user_permission(uuid, text) TO authenticated, service_role;

-- 3. HARDEN RLS ON CASE_DOCUMENTS
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and bench view documents" ON public.case_documents;
DROP POLICY IF EXISTS "Hardened view documents by sensitivity tier" ON public.case_documents;

CREATE POLICY "Hardened view documents by sensitivity tier" ON public.case_documents
  FOR SELECT TO authenticated
  USING (
    -- Admins can view all documents
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      -- Sealed Cover In-Camera: ONLY Judge assigned to case (or admin above)
      sensitivity_tier = 'SEALED_COVER_IN_CAMERA'::public.document_sensitivity_tier
      AND public.is_bench_user()
      AND EXISTS (
        SELECT 1 FROM public.schedules s
        WHERE s.case_id = case_documents.case_id AND s.judge_id = public.current_judge_id()
      )
    )
    OR (
      -- Restricted Investigation files: IO, FSL, Registrar, Evidence Custodian, or presiding Judge
      sensitivity_tier = 'RESTRICTED_INVESTIGATION'::public.document_sensitivity_tier
      AND (
        public.has_any_staff_role(auth.uid(), ARRAY['investigating_officer', 'forensic_officer', 'registrar', 'evidence_custodian'])
        OR (public.is_bench_user() AND EXISTS (
          SELECT 1 FROM public.schedules s
          WHERE s.case_id = case_documents.case_id AND s.judge_id = public.current_judge_id()
        ))
      )
    )
    OR (
      -- Confidential & Public files: accessible to all authenticated staff & bench (excluding general patrol for confidential)
      sensitivity_tier = 'CONFIDENTIAL'::public.document_sensitivity_tier
      AND (
        public.has_any_staff_role(auth.uid(), ARRAY['registrar', 'investigating_officer', 'forensic_officer', 'evidence_custodian'])
        OR public.is_bench_user()
      )
    )
    OR (
      -- Public court records: all authenticated users
      sensitivity_tier = 'PUBLIC'::public.document_sensitivity_tier
    )
  );

DROP POLICY IF EXISTS "Staff manage documents" ON public.case_documents;
DROP POLICY IF EXISTS "Hardened insert documents" ON public.case_documents;
DROP POLICY IF EXISTS "Hardened update documents" ON public.case_documents;
DROP POLICY IF EXISTS "Hardened delete documents" ON public.case_documents;

CREATE POLICY "Hardened insert documents" ON public.case_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.check_user_permission(auth.uid(), 'DOCUMENT_UPLOAD'));

CREATE POLICY "Hardened update documents" ON public.case_documents
  FOR UPDATE TO authenticated
  USING (public.check_user_permission(auth.uid(), 'DOCUMENT_VERSION'))
  WITH CHECK (public.check_user_permission(auth.uid(), 'DOCUMENT_VERSION'));

CREATE POLICY "Hardened delete documents" ON public.case_documents
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. HARDEN RLS ON DOCUMENT_VERSIONS
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and bench view document versions" ON public.document_versions;
DROP POLICY IF EXISTS "Hardened view document versions" ON public.document_versions;

CREATE POLICY "Hardened view document versions" ON public.document_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.case_documents d
      WHERE d.id = document_versions.document_id
    )
  );

DROP POLICY IF EXISTS "Staff insert document versions" ON public.document_versions;
DROP POLICY IF EXISTS "Hardened insert document versions" ON public.document_versions;

CREATE POLICY "Hardened insert document versions" ON public.document_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.check_user_permission(auth.uid(), 'DOCUMENT_VERSION'));

-- Prevent all destructive updates and deletes on immutable document versions
DROP POLICY IF EXISTS "No update on document versions" ON public.document_versions;
DROP POLICY IF EXISTS "No delete on document versions" ON public.document_versions;

-- 5. HARDEN RLS ON POLICE_ASSETS
ALTER TABLE public.police_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and bench view police assets" ON public.police_assets;
DROP POLICY IF EXISTS "Hardened view police assets" ON public.police_assets;

CREATE POLICY "Hardened view police assets" ON public.police_assets
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_any_staff_role(auth.uid(), ARRAY['registrar', 'investigating_officer', 'forensic_officer', 'evidence_custodian', 'police_officer'])
    OR (
      -- Bench is restricted to trial evidence attached to their active schedule
      public.is_bench_user() AND (
        case_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.schedules s
          WHERE s.case_id = police_assets.case_id AND s.judge_id = public.current_judge_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Staff manage police assets" ON public.police_assets;
DROP POLICY IF EXISTS "Hardened insert police assets" ON public.police_assets;
DROP POLICY IF EXISTS "Hardened update police assets" ON public.police_assets;
DROP POLICY IF EXISTS "Hardened delete police assets" ON public.police_assets;

CREATE POLICY "Hardened insert police assets" ON public.police_assets
  FOR INSERT TO authenticated
  WITH CHECK (public.check_user_permission(auth.uid(), 'ASSET_CREATE'));

CREATE POLICY "Hardened update police assets" ON public.police_assets
  FOR UPDATE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), 'ASSET_ASSIGN')
    OR public.check_user_permission(auth.uid(), 'ASSET_TRANSFER')
    OR public.check_user_permission(auth.uid(), 'ASSET_MAINTENANCE')
  )
  WITH CHECK (
    public.check_user_permission(auth.uid(), 'ASSET_ASSIGN')
    OR public.check_user_permission(auth.uid(), 'ASSET_TRANSFER')
    OR public.check_user_permission(auth.uid(), 'ASSET_MAINTENANCE')
  );

CREATE POLICY "Hardened delete police assets" ON public.police_assets
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 6. HARDEN RLS ON ASSET_TRANSFERS
ALTER TABLE public.asset_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view asset transfers" ON public.asset_transfers;
DROP POLICY IF EXISTS "Staff manage asset transfers" ON public.asset_transfers;
DROP POLICY IF EXISTS "Hardened view asset transfers" ON public.asset_transfers;
DROP POLICY IF EXISTS "Hardened insert asset transfers" ON public.asset_transfers;

CREATE POLICY "Hardened view asset transfers" ON public.asset_transfers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Hardened insert asset transfers" ON public.asset_transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_permission(auth.uid(), 'ASSET_TRANSFER')
    OR public.check_user_permission(auth.uid(), 'EVIDENCE_TRANSFER')
  );

-- 7. HARDEN RLS ON ASSET_MAINTENANCE
ALTER TABLE public.asset_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view asset maintenance" ON public.asset_maintenance;
DROP POLICY IF EXISTS "Staff manage asset maintenance" ON public.asset_maintenance;
DROP POLICY IF EXISTS "Hardened view asset maintenance" ON public.asset_maintenance;
DROP POLICY IF EXISTS "Hardened manage asset maintenance" ON public.asset_maintenance;

CREATE POLICY "Hardened view asset maintenance" ON public.asset_maintenance
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Hardened manage asset maintenance" ON public.asset_maintenance
  FOR ALL TO authenticated
  USING (public.check_user_permission(auth.uid(), 'ASSET_MAINTENANCE'))
  WITH CHECK (public.check_user_permission(auth.uid(), 'ASSET_MAINTENANCE'));

-- 8. HARDEN RLS ON EVIDENCE_CHAIN_OF_CUSTODY (IMMUTABLE AUDIT TRAIL)
ALTER TABLE public.evidence_chain_of_custody ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and bench view custody trail" ON public.evidence_chain_of_custody;
DROP POLICY IF EXISTS "Staff record custody events" ON public.evidence_chain_of_custody;
DROP POLICY IF EXISTS "Hardened view custody trail" ON public.evidence_chain_of_custody;
DROP POLICY IF EXISTS "Hardened insert custody events" ON public.evidence_chain_of_custody;

CREATE POLICY "Hardened view custody trail" ON public.evidence_chain_of_custody
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Hardened insert custody events" ON public.evidence_chain_of_custody
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_permission(auth.uid(), 'EVIDENCE_TRANSFER')
    OR public.check_user_permission(auth.uid(), 'EVIDENCE_CUSTODY')
  );
