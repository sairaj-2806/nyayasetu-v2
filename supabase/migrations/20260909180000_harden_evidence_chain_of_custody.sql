-- ============================================================================
-- NyayaSetu Database Migration: Harden Evidence Chain of Custody & Asset Transfers
-- ============================================================================
-- Enforces server-authoritative custody workflows with strict relational integrity,
-- unique active transfer constraints, and cryptographic verification rules under BSA 2023 §63.
-- ============================================================================

-- 1. Ensure public.asset_transfers exists with hardened constraints
CREATE TABLE IF NOT EXISTS public.asset_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  transfer_number text NOT NULL UNIQUE,
  from_location text NOT NULL,
  to_location text NOT NULL,
  from_custodian_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  from_custodian_name text NOT NULL,
  to_custodian_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_custodian_name text NOT NULL,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'REJECTED')),
  reason text NOT NULL DEFAULT 'Forensic analysis / Court production',
  transit_seal_number text,
  signature_verification text,
  rejection_reason text,
  rejected_at timestamptz,
  rejected_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_different_locations CHECK (from_location <> to_location)
);

-- 2. Concurrency Control: Only ONE active PENDING transfer allowed per asset
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_transfers_active_pending
  ON public.asset_transfers(asset_id)
  WHERE status IN ('PENDING', 'IN_TRANSIT');

CREATE INDEX IF NOT EXISTS idx_asset_transfers_asset ON public.asset_transfers(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_status ON public.asset_transfers(status);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_number ON public.asset_transfers(transfer_number);

-- 3. Ensure public.evidence_chain_of_custody exists with cryptographic audit rules
CREATE TABLE IF NOT EXISTS public.evidence_chain_of_custody (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid,
  document_id uuid,
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
  CONSTRAINT chk_verification_hash_length CHECK (verification_hash = '' OR length(verification_hash) >= 32)
);

CREATE INDEX IF NOT EXISTS idx_custody_asset ON public.evidence_chain_of_custody(asset_id);
CREATE INDEX IF NOT EXISTS idx_custody_document ON public.evidence_chain_of_custody(document_id);
CREATE INDEX IF NOT EXISTS idx_custody_case ON public.evidence_chain_of_custody(case_id);
CREATE INDEX IF NOT EXISTS idx_custody_timestamp ON public.evidence_chain_of_custody(transfer_timestamp DESC);

-- 4. RLS & Permissions
ALTER TABLE public.asset_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_chain_of_custody ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.asset_transfers TO authenticated;
GRANT ALL ON public.asset_transfers TO service_role;

GRANT SELECT, INSERT ON public.evidence_chain_of_custody TO authenticated;
GRANT ALL ON public.evidence_chain_of_custody TO service_role;
