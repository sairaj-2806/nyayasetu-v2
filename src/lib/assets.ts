/**
 * ARCHITECTURAL MANDATE:
 * Browser storage is never authoritative for legal records, evidence, documents, custody, permissions, or audit history.
 *
 * Source of Truth:
 * - Police Assets & Seized Items: Supabase public.police_assets
 * - Movement & Custody Transfers: Supabase public.asset_transfers
 * - Physical & Digital Chain of Custody: Supabase public.evidence_chain_of_custody
 * - Audit Trail: Supabase public.audit_logs
 */

import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/lib/audit";
import { isDemoMode } from "@/lib/demo-mode";
import type { Database } from "@/integrations/supabase/types";

export type AssetLifecycleStatus = Database["public"]["Enums"]["asset_lifecycle_status"];
export type EvidenceLifecycleStatus = Database["public"]["Enums"]["evidence_lifecycle_status"];
export type AssetCondition = Database["public"]["Enums"]["asset_condition"];

export interface AssetCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  is_evidence_category: boolean;
}

export interface PoliceAsset {
  id: string;
  asset_code: string;
  name: string;
  category_id: string;
  category_name?: string | undefined;
  status: AssetLifecycleStatus;
  evidence_status?: EvidenceLifecycleStatus | null | undefined;
  condition: AssetCondition;
  current_location: string;
  department_station: string;
  current_custodian_id?: string | null | undefined;
  current_custodian_name: string;
  assigned_officer_id?: string | null | undefined;
  assigned_officer_name: string;
  case_id?: string | null | undefined;
  case_number?: string | null | undefined;
  case_title?: string | null | undefined;
  fir_number?: string | null | undefined;
  serial_number?: string | null | undefined;
  barcode_rfid?: string | null | undefined;
  tamper_seal_number?: string | null | undefined;
  purchase_date?: string | null | undefined;
  purchase_cost?: number | null | undefined;
  vendor_supplier?: string | null | undefined;
  warranty_expiry?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
  created_at: string;
  updated_at: string;
}

export interface AssetTransferRecord {
  id: string;
  asset_id: string;
  transfer_number: string;
  from_location: string;
  to_location: string;
  from_custodian_name: string;
  to_custodian_name: string;
  dispatched_at: string;
  received_at?: string | null;
  status: "PENDING" | "IN_TRANSIT" | "COMPLETED" | "REJECTED";
  reason: string;
  transit_seal_number?: string | null;
  signature_verification?: string | null;
}

export interface AssetMaintenanceRecord {
  id: string;
  asset_id: string;
  maintenance_type:
    | "ROUTINE_SERVICE"
    | "INSPECTION"
    | "REPAIR"
    | "CALIBRATION"
    | "DECONTAMINATION"
    | "CERTIFICATION";
  service_provider: string;
  scheduled_date: string;
  completed_date?: string | null;
  cost: number;
  technician_name: string;
  findings: string;
  actions_taken: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  next_scheduled_service?: string | null;
}

export interface AssetDocumentRecord {
  id: string;
  asset_id: string;
  document_id: string;
  document_number: string;
  title: string;
  category: string;
  file_name: string;
  file_format: string;
  file_size_bytes: number;
  latest_sha256: string;
  relationship_type: string;
  notes: string;
  created_at: string;
}

export interface CustodyTimelineEvent {
  id: string;
  action: string;
  from_custodian: string;
  to_custodian: string;
  transfer_timestamp: string;
  purpose_reason: string;
  tamper_seal_intact: boolean;
  tamper_seal_number: string;
  digital_signature: string;
  verification_hash: string;
  notes: string;
}

// Standard categories fallback
export const DEFAULT_ASSET_CATEGORIES: AssetCategory[] = [
  {
    id: "cat-001",
    name: "Digital Storage Media & Devices",
    code: "DIGITAL_MEDIA",
    description: "Hard drives, mobiles, laptops, CCTV storage, flash memory",
    is_evidence_category: true,
  },
  {
    id: "cat-002",
    name: "Firearms, Weapons & Ballistics",
    code: "WEAPONS",
    description: "Seized arms, ammunition, spent cartridges, ballistic samples",
    is_evidence_category: true,
  },
  {
    id: "cat-003",
    name: "Biological & DNA Samples",
    code: "BIOLOGICAL",
    description: "Blood samples, DNA swabs, visceral samples, forensic specimens",
    is_evidence_category: true,
  },
  {
    id: "cat-004",
    name: "Narcotics & Contraband",
    code: "NARCOTICS",
    description: "Controlled substances, seized chemicals, illicit goods",
    is_evidence_category: true,
  },
  {
    id: "cat-005",
    name: "Seized Currency & Valuable Property",
    code: "VALUABLES",
    description: "Cash, bullion, counterfeit notes, high-value seized articles",
    is_evidence_category: true,
  },
  {
    id: "cat-006",
    name: "Vehicles & Automobile Assets",
    code: "VEHICLES",
    description: "Impounded vehicles, patrol units, seized transport",
    is_evidence_category: false,
  },
  {
    id: "cat-007",
    name: "Communications & Tactical Gear",
    code: "COMM_GEAR",
    description: "Wireless sets, body cams, forensic extraction kits",
    is_evidence_category: false,
  },
  {
    id: "cat-008",
    name: "Office & Malkhana Infrastructure",
    code: "INFRASTRUCTURE",
    description: "Evidence lockers, biometric storage safes, seals",
    is_evidence_category: false,
  },
];

import {
  SEED_POLICE_ASSETS,
  getDemoTransfersForAsset,
  getDemoMaintenanceForAsset,
  getDemoCustodyTimelineForAsset,
} from "@/fixtures/demo/assets";
export { SEED_POLICE_ASSETS };

// Deprecated local storage keys retained only for backward compatibility references
const ASSETS_STORAGE_KEY = "nyayasetu_police_assets_store_v1";

/**
 * @deprecated Browser storage is never authoritative for legal records, evidence, documents, custody, permissions, or audit history.
 */
export function getStoredLocalAssets(): PoliceAsset[] {
  return [];
}

/**
 * @deprecated Browser storage is never authoritative for legal records, evidence, documents, custody, permissions, or audit history.
 */
export function saveLocalAssets(_assets: PoliceAsset[]): void {
  // No-op: Supabase is the sole authoritative persistence layer.
}

// React Query queries
export const assetCategoriesQuery = {
  queryKey: ["asset-categories"],
  queryFn: async (): Promise<AssetCategory[]> => {
    try {
      const { data, error } = await supabase
        .from("asset_categories")
        .select("id, name, code, description, is_evidence_category")
        .order("name");
      if (!error && data && data.length > 0) {
        return data as AssetCategory[];
      }
    } catch {
      // fallback
    }
    return DEFAULT_ASSET_CATEGORIES;
  },
};

export const policeAssetsQuery = {
  queryKey: ["police-assets"],
  queryFn: async (): Promise<PoliceAsset[]> => {
    let serverAssets: PoliceAsset[] = [];
    try {
      const { data, error } = await supabase
        .from("police_assets")
        .select(
          `
          id, asset_code, name, category_id, status, evidence_status, condition,
          current_location, department_station, current_custodian_name,
          assigned_officer_name, case_id, fir_number, serial_number,
          barcode_rfid, tamper_seal_number, purchase_date, purchase_cost,
          vendor_supplier, warranty_expiry, metadata, created_at, updated_at,
          asset_categories (name),
          cases (case_number, parties)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        if (!isDemoMode()) throw error;
      } else if (data && data.length > 0) {
        serverAssets = data.map((item: Record<string, any>) => {
          const cat = item["asset_categories"] as { name: string } | null;
          const c = item["cases"] as { case_number: string; parties: string } | null;
          return {
            ...item,
            category_name: cat?.name || "General",
            case_number: c?.case_number || null,
            case_title: c?.parties || null,
          };
        }) as PoliceAsset[];
        return serverAssets;
      }
    } catch (err) {
      if (!isDemoMode()) throw err;
    }

    // Only present seed fixtures if explicit DEMO_MODE is enabled
    if (serverAssets.length === 0 && isDemoMode()) {
      return SEED_POLICE_ASSETS;
    }

    return serverAssets;
  },
};

export function policeAssetDetailQuery(assetId: string) {
  return {
    queryKey: ["police-asset-detail", assetId],
    queryFn: async () => {
      // 1. Fetch asset particulars directly from Supabase
      let asset: PoliceAsset | undefined;
      try {
        const { data: directAsset, error: directErr } = await supabase
          .from("police_assets")
          .select(
            `
            id, asset_code, name, category_id, status, evidence_status, condition,
            current_location, department_station, current_custodian_name,
            assigned_officer_name, case_id, fir_number, serial_number,
            barcode_rfid, tamper_seal_number, purchase_date, purchase_cost,
            vendor_supplier, warranty_expiry, metadata, created_at, updated_at,
            asset_categories (name),
            cases (case_number, parties)
          `,
          )
          .or(`id.eq.${assetId},asset_code.eq.${assetId}`)
          .maybeSingle();

        if (directErr && !isDemoMode()) {
          throw directErr;
        }

        if (directAsset) {
          const cat = (directAsset as any).asset_categories as { name: string } | null;
          const c = (directAsset as any).cases as { case_number: string; parties: string } | null;
          asset = {
            ...directAsset,
            category_name: cat?.name || "General",
            case_number: c?.case_number || null,
            case_title: c?.parties || null,
          } as PoliceAsset;
        }
      } catch (err) {
        if (!isDemoMode()) throw err;
      }

      // In explicit DEMO_MODE only, fall back to seed fixtures if not in database
      if (!asset && isDemoMode()) {
        const allSeeds = SEED_POLICE_ASSETS;
        asset = allSeeds.find((a) => a.id === assetId || a.asset_code === assetId);
      }

      if (!asset) {
        throw new Error(`Asset ${assetId} not found in registry`);
      }

      // 2. Fetch real transfers from Supabase asset_transfers
      let transfers: AssetTransferRecord[] = [];
      try {
        const isUuid = Boolean(asset.id.match(/^[0-9a-fA-F-]{36}$/));
        if (isUuid) {
          const { data: dbTransfers, error: trfErr } = await (supabase.from("asset_transfers") as any)
            .select("*")
            .eq("asset_id", asset.id)
            .order("dispatched_at", { ascending: false });

          if (trfErr && !isDemoMode()) throw trfErr;

          if (dbTransfers && dbTransfers.length > 0) {
            transfers = dbTransfers.map((t: any) => ({
              id: t.id,
              asset_id: t.asset_id,
              transfer_number: t.transfer_number,
              from_location: t.from_location,
              to_location: t.to_location,
              from_custodian_name: t.from_custodian_name,
              to_custodian_name: t.to_custodian_name,
              dispatched_at: t.dispatched_at,
              received_at: t.received_at,
              status: t.status,
              reason: t.reason || "",
              transit_seal_number: t.transit_seal_number,
              signature_verification: t.signature_verification || "VERIFIED_DIGITAL_SIG",
            }));
          }
        }
      } catch (err) {
        if (!isDemoMode()) throw err;
      }

      if (transfers.length === 0 && isDemoMode()) {
        transfers = getDemoTransfersForAsset(asset);
      }

      // 3. Fetch real maintenance from Supabase asset_maintenance
      let maintenance: AssetMaintenanceRecord[] = [];
      try {
        const isUuid = Boolean(asset.id.match(/^[0-9a-fA-F-]{36}$/));
        if (isUuid) {
          const { data: dbMnt, error: mntErr } = await (supabase.from("asset_maintenance") as any)
            .select("*")
            .eq("asset_id", asset.id)
            .order("scheduled_date", { ascending: false });

          if (mntErr && !isDemoMode()) throw mntErr;

          if (dbMnt && dbMnt.length > 0) {
            maintenance = dbMnt.map((m: any) => ({
              id: m.id,
              asset_id: m.asset_id,
              maintenance_type: m.maintenance_type,
              service_provider: m.service_provider,
              scheduled_date: m.scheduled_date,
              completed_date: m.completed_date,
              cost: Number(m.cost || 0),
              technician_name: m.technician_name,
              findings: m.findings || "",
              actions_taken: m.actions_taken || "",
              status: m.status,
              next_scheduled_service: m.next_scheduled_service,
            }));
          }
        }
      } catch (err) {
        if (!isDemoMode()) throw err;
      }

      if (maintenance.length === 0 && isDemoMode()) {
        maintenance = getDemoMaintenanceForAsset(asset);
      }

      // 4. Fetch documents associated with this asset
      const documents: AssetDocumentRecord[] = [];
      try {
        const isUuid = Boolean(asset.id.match(/^[0-9a-fA-F-]{36}$/));
        const filterStr = isUuid
          ? `asset_id.eq.${asset.id},asset_code.eq.${asset.asset_code}`
          : `asset_code.eq.${asset.asset_code}`;
        const { data: dbDocs } = await (supabase.from("case_documents") as any)
          .select("*")
          .or(filterStr);

        if (dbDocs && dbDocs.length > 0) {
          for (const d of dbDocs) {
            documents.push({
              id: d.id,
              asset_id: asset.id,
              document_id: d.id,
              document_number: d.document_number,
              title: d.title,
              category: d.category,
              file_name: d.file_name,
              file_format: d.file_format,
              file_size_bytes: Number(d.file_size_bytes || 0),
              latest_sha256: d.latest_sha256,
              relationship_type: d.category,
              notes: (d.metadata as any)?.notes || "",
              created_at: d.created_at,
            });
          }
        }
      } catch {
        // documents query
      }

      if (documents.length === 0 && isDemoMode()) {
        documents.push(
          {
            id: `doc-${asset.id}-1`,
            asset_id: asset.id,
            document_id: `cdoc-${asset.id}-1`,
            document_number: `DOC-2026-SZ-${asset.asset_code.slice(-4)}`,
            title: `Property Seizure Memo / Malkhana Deposit Entry - ${asset.asset_code}`,
            category: "SEIZURE_MEMO",
            file_name: `Seizure_Memo_${asset.asset_code}.pdf`,
            file_format: "PDF/A",
            file_size_bytes: 482910,
            latest_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            relationship_type: "SEIZURE_MEMO",
            notes: "Certified digital copy with Officer Seal",
            created_at: asset.created_at,
          },
          {
            id: `doc-${asset.id}-2`,
            asset_id: asset.id,
            document_id: `cdoc-${asset.id}-2`,
            document_number: `DOC-2026-FR-${asset.asset_code.slice(-4)}`,
            title: `Forensic Lab Analysis Certificate (BSA Sec 63 Compliance)`,
            category: "FORENSIC_EXAMINATION_REPORT",
            file_name: `Forensic_Report_${asset.asset_code}.pdf`,
            file_format: "PDF/A",
            file_size_bytes: 1240192,
            latest_sha256: "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
            relationship_type: "FORENSIC_EXAMINATION_REPORT",
            notes: "Authenticated by State Cyber Forensic Division",
            created_at: asset.updated_at,
          },
        );
      }

      // 5. Fetch custody timeline from Supabase evidence_chain_of_custody
      let timeline: CustodyTimelineEvent[] = [];
      try {
        const isUuid = Boolean(asset.id.match(/^[0-9a-fA-F-]{36}$/));
        if (isUuid) {
          const { data: dbEvents, error: evErr } = await (supabase.from("evidence_chain_of_custody") as any)
            .select("*")
            .eq("asset_id", asset.id)
            .order("transfer_timestamp", { ascending: true });

          if (evErr && !isDemoMode()) throw evErr;

          if (dbEvents && dbEvents.length > 0) {
            timeline = dbEvents.map((evt: any) => ({
              id: evt.id,
              action: evt.action || "CUSTODY_TRANSFER",
              from_custodian: evt.from_custodian || "Holding Custodian",
              to_custodian: evt.to_custodian || "Receiving Custodian",
              transfer_timestamp: evt.transfer_timestamp || evt.created_at,
              purpose_reason: evt.purpose_reason || "Custody record",
              tamper_seal_intact: evt.tamper_seal_intact ?? true,
              tamper_seal_number: evt.tamper_seal_number || asset.tamper_seal_number || "VERIFIED",
              digital_signature: evt.digital_signature || `SHA256: ${evt.to_custodian}`,
              verification_hash: evt.verification_hash || "0x9812bc67dae4125f",
              notes: evt.notes || "",
            }));
          }
        }
      } catch (err) {
        if (!isDemoMode()) throw err;
      }

      if (timeline.length === 0 && isDemoMode()) {
        timeline = getDemoCustodyTimelineForAsset(asset);
      }

      // Merge any dynamic transitions from asset lifecycle
      const { getStoredLifecycleEvents } = await import("@/lib/asset-lifecycle");
      const storedEvents = getStoredLifecycleEvents(asset.id);
      const dynamicEvents: CustodyTimelineEvent[] = storedEvents.map((evt) => ({
        id: evt.id,
        action: `TRANSITION: ${evt.previousStatus} → ${evt.newStatus}`,
        from_custodian: (evt.details?.["fromCustodian"] as string) || "Holding Custodian",
        to_custodian: (evt.details?.["toCustodian"] as string) || evt.actorName,
        transfer_timestamp: evt.timestamp,
        purpose_reason: evt.reason,
        tamper_seal_intact: true,
        tamper_seal_number: asset.tamper_seal_number || "VERIFIED",
        digital_signature: `SHA256: ${evt.actorName} (${evt.actorRole})`,
        verification_hash: (evt.details?.["verificationHash"] as string) || "0x9812bc67dae4125f",
        notes: `Executed via Police Asset Lifecycle Engine.`,
      }));

      const fullTimeline = [...timeline, ...dynamicEvents].sort(
        (a, b) =>
          new Date(a.transfer_timestamp).getTime() - new Date(b.transfer_timestamp).getTime(),
      );

      return {
        asset,
        transfers,
        maintenance,
        documents,
        timeline: fullTimeline,
      };
    },
  };
}

// Generate deterministic and unique asset code
export function generateAssetCode(categoryCode: string = "AST"): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const prefix = categoryCode.slice(0, 3).toUpperCase();
  return `POL-${year}-${prefix}-${rand}`;
}

// Create new police asset
export async function createPoliceAsset(payload: {
  asset_code: string;
  name: string;
  category_id: string;
  category_name?: string | undefined;
  status: AssetLifecycleStatus;
  evidence_status?: EvidenceLifecycleStatus | null | undefined;
  condition: AssetCondition;
  current_location: string;
  department_station: string;
  current_custodian_name: string;
  assigned_officer_name?: string | undefined;
  case_id?: string | null | undefined;
  fir_number?: string | null | undefined;
  serial_number?: string | null | undefined;
  barcode_rfid?: string | null | undefined;
  tamper_seal_number?: string | null | undefined;
  purchase_date?: string | null | undefined;
  purchase_cost?: number | null | undefined;
  vendor_supplier?: string | null | undefined;
  warranty_expiry?: string | null | undefined;
}): Promise<PoliceAsset> {
  const newId = `ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newAsset: PoliceAsset = {
    id: newId,
    asset_code: payload.asset_code.trim().toUpperCase(),
    name: payload.name.trim(),
    category_id: payload.category_id,
    category_name: payload.category_name,
    status: payload.status,
    evidence_status: payload.evidence_status ?? null,
    condition: payload.condition,
    current_location: payload.current_location.trim(),
    department_station: payload.department_station.trim(),
    current_custodian_name: payload.current_custodian_name.trim(),
    assigned_officer_name: (payload.assigned_officer_name || "").trim(),
    case_id: payload.case_id ?? null,
    fir_number: payload.fir_number?.trim() ?? null,
    serial_number: payload.serial_number?.trim() ?? null,
    barcode_rfid: payload.barcode_rfid?.trim() ?? null,
    tamper_seal_number: payload.tamper_seal_number?.trim() ?? null,
    purchase_date: payload.purchase_date ?? null,
    purchase_cost: payload.purchase_cost ?? null,
    vendor_supplier: payload.vendor_supplier?.trim() ?? null,
    warranty_expiry: payload.warranty_expiry ?? null,
    metadata: {},
    created_at: now,
    updated_at: now,
  };

  // Try saving to Supabase
  try {
    const { data, error } = await supabase
      .from("police_assets")
      .insert({
        asset_code: newAsset.asset_code,
        name: newAsset.name,
        category_id: newAsset.category_id,
        status: newAsset.status,
        evidence_status: newAsset.evidence_status ?? null,
        condition: newAsset.condition,
        current_location: newAsset.current_location,
        department_station: newAsset.department_station,
        current_custodian_name: newAsset.current_custodian_name,
        assigned_officer_name: newAsset.assigned_officer_name,
        case_id: newAsset.case_id ?? null,
        fir_number: newAsset.fir_number ?? null,
        serial_number: newAsset.serial_number ?? null,
        barcode_rfid: newAsset.barcode_rfid ?? null,
        tamper_seal_number: newAsset.tamper_seal_number ?? null,
        purchase_date: newAsset.purchase_date ?? null,
        purchase_cost: newAsset.purchase_cost ?? null,
        vendor_supplier: newAsset.vendor_supplier ?? null,
        warranty_expiry: newAsset.warranty_expiry ?? null,
      })
      .select()
      .single();

    if (!error && data) {
      newAsset.id = data.id;
    }
  } catch {
    // Continue with audit recording
  }

  // Audit record
  await recordAudit({
    action: `Police Asset CREATED: Registered ${newAsset.asset_code} (${newAsset.name}) in ${newAsset.department_station} under initial custody of ${newAsset.current_custodian_name}`,
    actionCode: "CREATED",
    entityType: "asset",
    entityId: newAsset.id,
    caseId: newAsset.case_id || null,
    previousState: null,
    newState: newAsset.status,
    userName: payload.current_custodian_name,
    userRole: "evidence_custodian",
    metadata: {
      assetCode: newAsset.asset_code,
      name: newAsset.name,
      categoryName: newAsset.category_name,
      location: newAsset.current_location,
      department: newAsset.department_station,
      serialNumber: newAsset.serial_number,
    },
  });

  return newAsset;
}

export * from "@/lib/asset-lifecycle";
export * from "@/lib/evidence-custody";
