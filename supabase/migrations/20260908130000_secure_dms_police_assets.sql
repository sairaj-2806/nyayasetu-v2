-- ============================================================================
-- MIGRATION: 20260908130000_secure_dms_police_assets.sql
-- DESCRIPTION: Foundation for Secure Digital Document Management System (DMS)
--              and Police Asset & Malkhana Evidence Lifecycle Management.
-- COMPLIANCE: Aligns with Ministry of Home Affairs (MHA), National Crime Records
--             Bureau (NCRB), and Bharatiya Sakshya Adhiniyam (BSA, 2023).
-- SAFETY: Fully additive. Zero modifications or drops on existing tables.
-- ============================================================================

-- 1. ENUMS FOR ASSET & EVIDENCE LIFECYCLES
DO $$ BEGIN
  CREATE TYPE public.asset_lifecycle_status AS ENUM (
    'REGISTERED',
    'AVAILABLE',
    'ASSIGNED',
    'IN_USE',
    'TRANSFERRED',
    'MAINTENANCE',
    'RETURNED',
    'RETIRED',
    'LOST'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.evidence_lifecycle_status AS ENUM (
    'SEIZED',
    'REGISTERED',
    'SEALED',
    'STORED',
    'TRANSFERRED',
    'FORENSIC_EXAMINATION',
    'RETURNED',
    'COURT_SUBMISSION',
    'DISPOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_condition AS ENUM (
    'NEW',
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'DAMAGED',
    'NEEDS_REPAIR',
    'DECOMMISSIONED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.document_sensitivity_tier AS ENUM (
    'PUBLIC',
    'RESTRICTED',
    'SEALED_COVER_IN_CAMERA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. ASSET CATEGORIES
CREATE TABLE IF NOT EXISTS public.asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  is_evidence_category boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_categories TO authenticated;
GRANT ALL ON public.asset_categories TO service_role;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and bench view asset categories" ON public.asset_categories;
CREATE POLICY "Staff and bench view asset categories" ON public.asset_categories
  FOR SELECT TO authenticated
  USING (public.is_registry_staff() OR public.is_bench_user());

DROP POLICY IF EXISTS "Admins manage asset categories" ON public.asset_categories;
CREATE POLICY "Admins manage asset categories" ON public.asset_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_asset_categories_updated BEFORE UPDATE ON public.asset_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial standard asset categories
INSERT INTO public.asset_categories (name, code, description, is_evidence_category) VALUES
  ('Digital Storage Media & Devices', 'DIGITAL_MEDIA', 'Hard drives, mobiles, laptops, CCTV storage, flash memory', true),
  ('Firearms, Weapons & Ballistics', 'WEAPONS', 'Seized arms, ammunition, spent cartridges, ballistic samples', true),
  ('Biological & DNA Samples', 'BIOLOGICAL', 'Blood samples, DNA swabs, visceral samples, forensic specimens', true),
  ('Narcotics & Contraband', 'NARCOTICS', 'Controlled substances, seized chemicals, illicit goods', true),
  ('Seized Currency & Valuable Property', 'VALUABLES', 'Cash, bullion, counterfeit notes, high-value seized articles', true),
  ('Vehicles & Automobile Assets', 'VEHICLES', 'Impounded vehicles, patrol units, seized transport', false),
  ('Communications & Tactical Gear', 'COMM_GEAR', 'Wireless sets, body cams, forensic extraction kits', false),
  ('Office & Malkhana Infrastructure', 'INFRASTRUCTURE', 'Evidence lockers, biometric storage safes, seals', false)
ON CONFLICT (name) DO NOTHING;

-- 3. POLICE ASSETS & SEIZED EVIDENCE REGISTRY
CREATE TABLE IF NOT EXISTS public.police_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code text NOT NULL UNIQUE,
  name text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.asset_categories(id) ON DELETE RESTRICT,
  status public.asset_lifecycle_status NOT NULL DEFAULT 'REGISTERED',
  evidence_status public.evidence_lifecycle_status,
  condition public.asset_condition NOT NULL DEFAULT 'GOOD',
  current_location text NOT NULL DEFAULT 'Central Police Malkhana',
  department_station text NOT NULL DEFAULT 'North District Police Station',
  current_custodian_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  current_custodian_name text NOT NULL DEFAULT '',
  assigned_officer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_officer_name text NOT NULL DEFAULT '',
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  fir_number text,
  serial_number text,
  barcode_rfid text,
  tamper_seal_number text,
  purchase_date date,
  purchase_cost numeric,
  vendor_supplier text,
  warranty_expiry date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_police_assets_case ON public.police_assets(case_id);
CREATE INDEX IF NOT EXISTS idx_police_assets_status ON public.police_assets(status);
CREATE INDEX IF NOT EXISTS idx_police_assets_evidence_status ON public.police_assets(evidence_status);
CREATE INDEX IF NOT EXISTS idx_police_assets_station ON public.police_assets(department_station);
CREATE INDEX IF NOT EXISTS idx_police_assets_code ON public.police_assets(asset_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.police_assets TO authenticated;
GRANT ALL ON public.police_assets TO service_role;
ALTER TABLE public.police_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and bench view police assets" ON public.police_assets;
CREATE POLICY "Staff and bench view police assets" ON public.police_assets
  FOR SELECT TO authenticated
  USING (
    public.is_registry_staff()
    OR (
      public.is_bench_user() AND (
        case_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.schedules s
          WHERE s.case_id = police_assets.case_id AND s.judge_id = public.current_judge_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Staff manage police assets" ON public.police_assets;
CREATE POLICY "Staff manage police assets" ON public.police_assets
  FOR ALL TO authenticated
  USING (public.is_registry_staff())
  WITH CHECK (public.is_registry_staff());

CREATE TRIGGER trg_police_assets_updated BEFORE UPDATE ON public.police_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. ASSET ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.police_assets(id) ON DELETE CASCADE,
  officer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  officer_name text NOT NULL,
  officer_badge text NOT NULL DEFAULT '',
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignment_date timestamptz NOT NULL DEFAULT now(),
  expected_return_date timestamptz,
  actual_return_date timestamptz,
  purpose text NOT NULL DEFAULT 'Investigation Duty',
  condition_at_checkout text NOT NULL DEFAULT 'Good',
  condition_at_checkin text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETURNED', 'OVERDUE')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset ON public.asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_officer ON public.asset_assignments(officer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_assignments TO authenticated;
GRANT ALL ON public.asset_assignments TO service_role;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view asset assignments" ON public.asset_assignments;
CREATE POLICY "Staff view asset assignments" ON public.asset_assignments
  FOR SELECT TO authenticated USING (public.is_registry_staff() OR public.is_bench_user());

DROP POLICY IF EXISTS "Staff manage asset assignments" ON public.asset_assignments;
CREATE POLICY "Staff manage asset assignments" ON public.asset_assignments
  FOR ALL TO authenticated USING (public.is_registry_staff()) WITH CHECK (public.is_registry_staff());

CREATE TRIGGER trg_asset_assignments_updated BEFORE UPDATE ON public.asset_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. ASSET MOVEMENTS & TRANSFERS
CREATE TABLE IF NOT EXISTS public.asset_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.police_assets(id) ON DELETE CASCADE,
  transfer_number text NOT NULL UNIQUE,
  from_location text NOT NULL,
  to_location text NOT NULL,
  from_custodian_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  from_custodian_name text NOT NULL,
  to_custodian_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_custodian_name text NOT NULL,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  status text NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'REJECTED')),
  reason text NOT NULL DEFAULT 'Forensic analysis / Court production',
  transit_seal_number text,
  signature_verification text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_transfers_asset ON public.asset_transfers(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_number ON public.asset_transfers(transfer_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_transfers TO authenticated;
GRANT ALL ON public.asset_transfers TO service_role;
ALTER TABLE public.asset_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view asset transfers" ON public.asset_transfers;
CREATE POLICY "Staff view asset transfers" ON public.asset_transfers
  FOR SELECT TO authenticated USING (public.is_registry_staff() OR public.is_bench_user());

DROP POLICY IF EXISTS "Staff manage asset transfers" ON public.asset_transfers;
CREATE POLICY "Staff manage asset transfers" ON public.asset_transfers
  FOR ALL TO authenticated USING (public.is_registry_staff()) WITH CHECK (public.is_registry_staff());

-- 6. ASSET MAINTENANCE RECORDS
CREATE TABLE IF NOT EXISTS public.asset_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.police_assets(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL CHECK (maintenance_type IN ('ROUTINE_SERVICE', 'INSPECTION', 'REPAIR', 'CALIBRATION', 'DECONTAMINATION', 'CERTIFICATION')),
  service_provider text NOT NULL DEFAULT 'Internal Armory / Police Workshop',
  scheduled_date date NOT NULL DEFAULT current_date,
  completed_date date,
  cost numeric NOT NULL DEFAULT 0,
  technician_name text NOT NULL DEFAULT '',
  findings text NOT NULL DEFAULT '',
  actions_taken text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  next_scheduled_service date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_maintenance_asset ON public.asset_maintenance(asset_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_maintenance TO authenticated;
GRANT ALL ON public.asset_maintenance TO service_role;
ALTER TABLE public.asset_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view asset maintenance" ON public.asset_maintenance;
CREATE POLICY "Staff view asset maintenance" ON public.asset_maintenance
  FOR SELECT TO authenticated USING (public.is_registry_staff());

DROP POLICY IF EXISTS "Staff manage asset maintenance" ON public.asset_maintenance;
CREATE POLICY "Staff manage asset maintenance" ON public.asset_maintenance
  FOR ALL TO authenticated USING (public.is_registry_staff()) WITH CHECK (public.is_registry_staff());

CREATE TRIGGER trg_asset_maintenance_updated BEFORE UPDATE ON public.asset_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. SECURE CASE DOCUMENTS (LEGAL & INVESTIGATION RECORD REPOSITORY)
CREATE TABLE IF NOT EXISTS public.case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  document_number text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL,
  fir_number text,
  police_station text NOT NULL DEFAULT '',
  sensitivity_tier public.document_sensitivity_tier NOT NULL DEFAULT 'PUBLIC',
  current_version integer NOT NULL DEFAULT 1,
  file_name text NOT NULL,
  file_format text NOT NULL DEFAULT 'PDF',
  file_size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL DEFAULT '',
  latest_sha256 text NOT NULL,
  is_sealed boolean NOT NULL DEFAULT false,
  is_tampered boolean NOT NULL DEFAULT false,
  originating_agency text NOT NULL DEFAULT 'Police Department / CCTNS',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_documents_case ON public.case_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_category ON public.case_documents(category);
CREATE INDEX IF NOT EXISTS idx_case_documents_sensitivity ON public.case_documents(sensitivity_tier);
CREATE INDEX IF NOT EXISTS idx_case_documents_sha256 ON public.case_documents(latest_sha256);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_documents TO authenticated;
GRANT ALL ON public.case_documents TO service_role;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and bench view documents" ON public.case_documents;
CREATE POLICY "Staff and bench view documents" ON public.case_documents
  FOR SELECT TO authenticated
  USING (
    public.is_registry_staff()
    OR (
      public.is_bench_user() AND (
        sensitivity_tier != 'SEALED_COVER_IN_CAMERA'::public.document_sensitivity_tier
        OR EXISTS (
          SELECT 1 FROM public.schedules s
          WHERE s.case_id = case_documents.case_id AND s.judge_id = public.current_judge_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Staff manage documents" ON public.case_documents;
CREATE POLICY "Staff manage documents" ON public.case_documents
  FOR ALL TO authenticated
  USING (public.is_registry_staff())
  WITH CHECK (public.is_registry_staff());

CREATE TRIGGER trg_case_documents_updated BEFORE UPDATE ON public.case_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. DOCUMENT VERSIONS (IMMUTABLE VERSION CONTROL)
CREATE TABLE IF NOT EXISTS public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL DEFAULT '',
  sha256_hash text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_summary text NOT NULL DEFAULT 'Initial version',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON public.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_hash ON public.document_versions(sha256_hash);

GRANT SELECT, INSERT ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and bench view document versions" ON public.document_versions;
CREATE POLICY "Staff and bench view document versions" ON public.document_versions
  FOR SELECT TO authenticated USING (public.is_registry_staff() OR public.is_bench_user());

DROP POLICY IF EXISTS "Staff insert document versions" ON public.document_versions;
CREATE POLICY "Staff insert document versions" ON public.document_versions
  FOR INSERT TO authenticated WITH CHECK (public.is_registry_staff());

-- 9. DOCUMENT INTEGRITY & BLOCKCHAIN METADATA
CREATE TABLE IF NOT EXISTS public.document_integrity_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.document_versions(id) ON DELETE CASCADE,
  sha256_hash text NOT NULL,
  blockchain_block_number integer,
  blockchain_block_hash text,
  merkle_root text,
  validator_node text,
  digital_signature text,
  signer_identity text,
  certificate_ref text,
  bsa_compliance_clause text NOT NULL DEFAULT 'Certified under Section 63, Bharatiya Sakshya Adhiniyam, 2023 / Section 65B Indian Evidence Act',
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  verification_status text NOT NULL DEFAULT 'VERIFIED' CHECK (verification_status IN ('VERIFIED', 'TAMPER_DETECTED', 'PENDING_VERIFICATION')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrity_doc ON public.document_integrity_metadata(document_id);
CREATE INDEX IF NOT EXISTS idx_integrity_hash ON public.document_integrity_metadata(sha256_hash);

GRANT SELECT, INSERT, UPDATE ON public.document_integrity_metadata TO authenticated;
GRANT ALL ON public.document_integrity_metadata TO service_role;
ALTER TABLE public.document_integrity_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and bench view integrity metadata" ON public.document_integrity_metadata;
CREATE POLICY "Staff and bench view integrity metadata" ON public.document_integrity_metadata
  FOR SELECT TO authenticated USING (public.is_registry_staff() OR public.is_bench_user());

DROP POLICY IF EXISTS "Staff manage integrity metadata" ON public.document_integrity_metadata;
CREATE POLICY "Staff manage integrity metadata" ON public.document_integrity_metadata
  FOR ALL TO authenticated USING (public.is_registry_staff()) WITH CHECK (public.is_registry_staff());

-- 10. ASSET-DOCUMENT RELATIONSHIPS (JUNCTION TABLE)
CREATE TABLE IF NOT EXISTS public.asset_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.police_assets(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN (
    'SEIZURE_MEMO',
    'FORENSIC_EXAMINATION_REPORT',
    'PURCHASE_RECEIPT',
    'MAINTENANCE_RECORD',
    'CHAIN_OF_CUSTODY_RECEIPT',
    'SUPERDARI_BOND',
    'DISPOSAL_ORDER',
    'PHOTOGRAPHIC_EVIDENCE',
    'OTHER'
  )),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, document_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_asset_docs_asset ON public.asset_documents(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_docs_document ON public.asset_documents(document_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_documents TO authenticated;
GRANT ALL ON public.asset_documents TO service_role;
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and bench view asset documents" ON public.asset_documents;
CREATE POLICY "Staff and bench view asset documents" ON public.asset_documents
  FOR SELECT TO authenticated USING (public.is_registry_staff() OR public.is_bench_user());

DROP POLICY IF EXISTS "Staff manage asset documents" ON public.asset_documents;
CREATE POLICY "Staff manage asset documents" ON public.asset_documents
  FOR ALL TO authenticated USING (public.is_registry_staff()) WITH CHECK (public.is_registry_staff());

-- 11. EVIDENCE CHAIN OF CUSTODY (IMMUTABLE LIFECYCLE AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.evidence_chain_of_custody (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.police_assets(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.case_documents(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  action text NOT NULL,
  from_custodian text NOT NULL,
  to_custodian text NOT NULL,
  transfer_timestamp timestamptz NOT NULL DEFAULT now(),
  purpose_reason text NOT NULL DEFAULT '',
  tamper_seal_intact boolean NOT NULL DEFAULT true,
  tamper_seal_number text NOT NULL DEFAULT '',
  digital_signature text NOT NULL DEFAULT '',
  verification_hash text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_custody_target CHECK (asset_id IS NOT NULL OR document_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_custody_asset ON public.evidence_chain_of_custody(asset_id);
CREATE INDEX IF NOT EXISTS idx_custody_document ON public.evidence_chain_of_custody(document_id);
CREATE INDEX IF NOT EXISTS idx_custody_case ON public.evidence_chain_of_custody(case_id);
CREATE INDEX IF NOT EXISTS idx_custody_timestamp ON public.evidence_chain_of_custody(transfer_timestamp DESC);

GRANT SELECT, INSERT ON public.evidence_chain_of_custody TO authenticated;
GRANT ALL ON public.evidence_chain_of_custody TO service_role;
ALTER TABLE public.evidence_chain_of_custody ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and bench view custody trail" ON public.evidence_chain_of_custody;
CREATE POLICY "Staff and bench view custody trail" ON public.evidence_chain_of_custody
  FOR SELECT TO authenticated USING (public.is_registry_staff() OR public.is_bench_user());

DROP POLICY IF EXISTS "Staff record custody events" ON public.evidence_chain_of_custody;
CREATE POLICY "Staff record custody events" ON public.evidence_chain_of_custody
  FOR INSERT TO authenticated WITH CHECK (public.is_registry_staff());
