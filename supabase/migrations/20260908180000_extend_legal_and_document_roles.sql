-- ============================================================================
-- MIGRATION: 20260908180000_extend_legal_and_document_roles.sql
-- DESCRIPTION: Extends app_role enum with legal_officer and document_officer,
--              updates check_user_permission and RLS policies for SIH 26190.
-- SAFETY: Fully backward compatible. Additive enum values and idempotent helpers.
-- ============================================================================

-- 1. EXTEND APP_ROLE ENUM
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'legal_officer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'document_officer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. UPDATE PERMISSION CHECKING FUNCTION
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
      RETURN _role IN ('registrar', 'investigating_officer', 'forensic_officer', 'evidence_custodian', 'document_officer');
    WHEN 'DOCUMENT_VERSION' THEN
      RETURN _role IN ('registrar', 'investigating_officer', 'forensic_officer', 'document_officer');
    WHEN 'DOCUMENT_DOWNLOAD' THEN
      RETURN true;
    WHEN 'DOCUMENT_SIGN' THEN
      RETURN _role IN ('judge', 'registrar', 'investigating_officer', 'forensic_officer', 'evidence_custodian', 'legal_officer', 'document_officer');

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
      RETURN _role IN ('registrar', 'investigating_officer', 'forensic_officer', 'evidence_custodian', 'legal_officer', 'document_officer');

    ELSE
      RETURN false;
  END CASE;
END;
$$;
