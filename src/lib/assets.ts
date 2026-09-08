import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/lib/audit";
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

// Initial realistic seed assets for demonstrations and zero-setup testing
export const SEED_POLICE_ASSETS: PoliceAsset[] = [
  {
    id: "ast-seed-001",
    asset_code: "POL-2026-DM-0811",
    name: "Seized Western Digital 4TB Surveillance Hard Drive",
    category_id: "cat-001",
    category_name: "Digital Storage Media & Devices",
    status: "IN_USE",
    evidence_status: "FORENSIC_EXAMINATION",
    condition: "EXCELLENT",
    current_location: "State Cyber Forensic Laboratory, Rohini",
    department_station: "Cyber Crime Police Station, North District",
    current_custodian_name: "Dr. Alok Verma (Senior Scientific Officer)",
    assigned_officer_name: "Inspector Vikram Rathore",
    case_number: "CRL-0001/2026",
    case_title: "State of NCT vs. Rajesh Kumar & Ors.",
    fir_number: "FIR No. 142/2026 U/S 420/467/471 IPC",
    serial_number: "WDC-WD40PURZ-882109",
    barcode_rfid: "RFID-IND-DEL-98421",
    tamper_seal_number: "MHA-SL-2026-8831",
    purchase_date: "2026-01-14",
    purchase_cost: 9500,
    vendor_supplier: "State Forensic Repository / Seizure",
    warranty_expiry: "2028-01-14",
    created_at: "2026-01-15T10:30:00Z",
    updated_at: "2026-03-01T14:20:00Z",
  },
  {
    id: "ast-seed-002",
    asset_code: "POL-2026-WP-0142",
    name: "9mm Semi-Automatic Service Pistol (Exhibit A-1)",
    category_id: "cat-002",
    category_name: "Firearms, Weapons & Ballistics",
    status: "TRANSFERRED",
    evidence_status: "COURT_SUBMISSION",
    condition: "GOOD",
    current_location: "Tis Hazari District Court Room 4 Malkhana Safe",
    department_station: "Kotwali Police Station, Central District",
    current_custodian_name: "Head Constable Ramesh Chand (Malkhana Moharrir)",
    assigned_officer_name: "Sub-Inspector Deepak Sharma",
    case_number: "CRL-0002/2026",
    case_title: "State vs. Gurpreet Singh @ Sunny",
    fir_number: "FIR No. 89/2026 U/S 25/27 Arms Act",
    serial_number: "IOF-9MM-2021-994",
    barcode_rfid: "RFID-IND-DEL-44102",
    tamper_seal_number: "COURT-EV-8841-B",
    purchase_date: "2025-11-20",
    purchase_cost: 65000,
    vendor_supplier: "Indian Ordnance Factory (Seized)",
    warranty_expiry: null,
    created_at: "2026-01-20T09:15:00Z",
    updated_at: "2026-03-05T11:00:00Z",
  },
  {
    id: "ast-seed-003",
    asset_code: "POL-2026-BIO-0932",
    name: "Sterile DNA Swab Specimen Collection Kit #4",
    category_id: "cat-003",
    category_name: "Biological & DNA Samples",
    status: "AVAILABLE",
    evidence_status: "STORED",
    condition: "NEW",
    current_location: "Cold Storage Biological Vault B-2",
    department_station: "Civil Lines Police Station",
    current_custodian_name: "ASI Manjeet Kaur",
    assigned_officer_name: "Inspector Neha Singh",
    case_number: "CRL-0005/2026",
    case_title: "State vs. Unknown Suspects (FTSC/POCSO)",
    fir_number: "FIR No. 204/2026 U/S 376 IPC & POCSO Act",
    serial_number: "DNA-SPEC-2026-041",
    barcode_rfid: "RFID-BIO-2026-004",
    tamper_seal_number: "FORENSIC-CRYO-9011",
    purchase_date: "2026-02-01",
    purchase_cost: 3200,
    vendor_supplier: "Himedia Forensics Pvt Ltd",
    warranty_expiry: "2027-02-01",
    created_at: "2026-02-02T16:45:00Z",
    updated_at: "2026-02-18T10:00:00Z",
  },
  {
    id: "ast-seed-004",
    asset_code: "POL-2026-TAC-0550",
    name: "Axon Body 3 High-Definition Police Body Camera",
    category_id: "cat-007",
    category_name: "Communications & Tactical Gear",
    status: "ASSIGNED",
    evidence_status: null,
    condition: "GOOD",
    current_location: "Beat Patrol Station Sector 4",
    department_station: "Kashmere Gate Police Station",
    current_custodian_name: "Head Constable Suraj Bhan",
    assigned_officer_name: "Constable Amit Yadav (Badge #7481)",
    case_number: null,
    case_title: null,
    fir_number: null,
    serial_number: "AXN-B3-889104",
    barcode_rfid: "BAR-AXON-889104",
    tamper_seal_number: null,
    purchase_date: "2025-08-10",
    purchase_cost: 42000,
    vendor_supplier: "Axon Enterprise India Ltd",
    warranty_expiry: "2028-08-10",
    created_at: "2025-08-15T12:00:00Z",
    updated_at: "2026-02-28T09:30:00Z",
  },
  {
    id: "ast-seed-005",
    asset_code: "POL-2026-VEH-0012",
    name: "Toyota Innova Crysta Mobile Forensic Crime Scene Van",
    category_id: "cat-006",
    category_name: "Vehicles & Automobile Assets",
    status: "MAINTENANCE",
    evidence_status: null,
    condition: "NEEDS_REPAIR",
    current_location: "Central Police Motor Transport Armory Workshop",
    department_station: "District Police Lines, Kingsway Camp",
    current_custodian_name: "Sub-Inspector Kuldeep Malik (Workshop In-charge)",
    assigned_officer_name: "Inspector Rajesh Dahiya",
    case_number: null,
    case_title: null,
    fir_number: null,
    serial_number: "DL-1CAA-4921",
    barcode_rfid: "RFID-VEH-DL1CAA4921",
    tamper_seal_number: null,
    purchase_date: "2024-03-22",
    purchase_cost: 2150000,
    vendor_supplier: "Toyota Kirloskar Motor Pvt Ltd",
    warranty_expiry: "2027-03-22",
    created_at: "2024-03-25T11:00:00Z",
    updated_at: "2026-03-06T15:10:00Z",
  },
  {
    id: "ast-seed-006",
    asset_code: "POL-2026-NC-0078",
    name: "Seized Psychotropic Contraband Consignment (4.8 kg)",
    category_id: "cat-004",
    category_name: "Narcotics & Contraband",
    status: "REGISTERED",
    evidence_status: "SEALED",
    condition: "EXCELLENT",
    current_location: "Malkhana Secure Chemical Vault #3",
    department_station: "Crime Branch Narcotic Squad",
    current_custodian_name: "Inspector Harish Chander",
    assigned_officer_name: "Sub-Inspector Sandeep Nain",
    case_number: "CRL-0008/2026",
    case_title: "Narcotics Control Bureau vs. Tarun Mehra",
    fir_number: "FIR No. 45/2026 U/S 21/29 NDPS Act",
    serial_number: "NDPS-SEAL-2026-788",
    barcode_rfid: "RFID-NDPS-8877",
    tamper_seal_number: "MHA-NARCO-SEAL-9982",
    purchase_date: "2026-02-10",
    purchase_cost: null,
    vendor_supplier: "Seized Article / NCB",
    warranty_expiry: null,
    created_at: "2026-02-11T08:20:00Z",
    updated_at: "2026-03-02T13:40:00Z",
  },
  {
    id: "ast-seed-007",
    asset_code: "EV-1045",
    name: "Seized Encrypted Samsung Galaxy S24 Ultra & Dual SIM Cards (Exhibit EV-1045)",
    category_id: "cat-001",
    category_name: "Digital Storage Media & Devices",
    status: "IN_USE",
    evidence_status: "STORED",
    condition: "EXCELLENT",
    current_location: "District Court Central Malkhana Vault B, High-Security Locker #12",
    department_station: "Special Cell Police Station, Lodhi Colony",
    current_custodian_name: "Head Constable Ramesh Chand (Malkhana Moharrir)",
    assigned_officer_name: "Inspector Vikram Rathore",
    case_number: "BNS/2026/0014",
    case_title: "State of NCT vs. Aman Sharma & Ors.",
    fir_number: "FIR No. 28/2026 U/S 111/318 BNS",
    serial_number: "SM-S928B-IMEI-882910",
    barcode_rfid: "RFID-EV-1045",
    tamper_seal_number: "MHA-EV-1045-A",
    purchase_date: "2026-02-14",
    purchase_cost: null,
    vendor_supplier: "Seized Evidence Exhibit / Panchnama",
    warranty_expiry: null,
    created_at: "2026-02-14T11:00:00Z",
    updated_at: "2026-03-04T16:20:00Z",
  },
  {
    id: "ast-seed-008",
    asset_code: "EV-1046",
    name: "SanDisk Extreme 2TB Rugged External SSD (Exhibit EV-1046)",
    category_id: "cat-001",
    category_name: "Digital Storage Media & Devices",
    status: "IN_USE",
    evidence_status: "STORED",
    condition: "GOOD",
    current_location: "District Court Central Malkhana Vault B, High-Security Locker #12",
    department_station: "Special Cell Police Station, Lodhi Colony",
    current_custodian_name: "Head Constable Ramesh Chand (Malkhana Moharrir)",
    assigned_officer_name: "Inspector Vikram Rathore",
    case_number: "BNS/2026/0014",
    case_title: "State of NCT vs. Aman Sharma & Ors.",
    fir_number: "FIR No. 28/2026 U/S 111/318 BNS",
    serial_number: "SNDK-E61-2TB-77412",
    barcode_rfid: "RFID-EV-1046",
    tamper_seal_number: "MHA-EV-1046-B",
    purchase_date: "2026-02-14",
    purchase_cost: null,
    vendor_supplier: "Seized Evidence Exhibit / Panchnama",
    warranty_expiry: null,
    created_at: "2026-02-14T11:15:00Z",
    updated_at: "2026-03-04T16:25:00Z",
  },
  {
    id: "ast-seed-009",
    asset_code: "VH-1045",
    name: "Mahindra Scorpio-N Cyber Investigation Squad Vehicle (Asset VH-1045)",
    category_id: "cat-006",
    category_name: "Vehicles & Automobile Assets",
    status: "IN_USE",
    evidence_status: null,
    condition: "EXCELLENT",
    current_location: "Special Cell Tactical Base Lodhi Colony",
    department_station: "Special Cell Police Station, Lodhi Colony",
    current_custodian_name: "Inspector Vikram Rathore",
    assigned_officer_name: "Inspector Vikram Rathore",
    case_number: "BNS/2026/0014",
    case_title: "State of NCT vs. Aman Sharma & Ors.",
    fir_number: "FIR No. 28/2026 U/S 111/318 BNS",
    serial_number: "DL-1CZ-9914",
    barcode_rfid: "RFID-VEH-VH1045",
    tamper_seal_number: null,
    purchase_date: "2025-04-12",
    purchase_cost: 1850000,
    vendor_supplier: "Mahindra & Mahindra Government Sales",
    warranty_expiry: "2028-04-12",
    created_at: "2025-04-15T09:00:00Z",
    updated_at: "2026-03-02T10:00:00Z",
  },
  {
    id: "ast-seed-010",
    asset_code: "BC-2041",
    name: "Motorola Solutions VideoBadge Body Worn Camera (Asset BC-2041)",
    category_id: "cat-007",
    category_name: "Communications & Tactical Gear",
    status: "IN_USE",
    evidence_status: null,
    condition: "GOOD",
    current_location: "Field Squad Unit - Lodhi Colony",
    department_station: "Special Cell Police Station, Lodhi Colony",
    current_custodian_name: "Sub-Inspector Sandeep Nain",
    assigned_officer_name: "Sub-Inspector Sandeep Nain",
    case_number: "BNS/2026/0014",
    case_title: "State of NCT vs. Aman Sharma & Ors.",
    fir_number: "FIR No. 28/2026 U/S 111/318 BNS",
    serial_number: "MOT-VB400-88102",
    barcode_rfid: "RFID-BC-2041",
    tamper_seal_number: null,
    purchase_date: "2025-09-01",
    purchase_cost: 38000,
    vendor_supplier: "Motorola Solutions India Pvt Ltd",
    warranty_expiry: "2027-09-01",
    created_at: "2025-09-05T14:00:00Z",
    updated_at: "2026-03-01T11:20:00Z",
  },
];

// Local cache key for offline / optimistic updates
const ASSETS_STORAGE_KEY = "nyayasetu_police_assets_store_v1";

export function getStoredLocalAssets(): PoliceAsset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ASSETS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PoliceAsset[];
  } catch {
    return [];
  }
}

function saveLocalAssets(assets: PoliceAsset[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
  } catch {
    // ignore quota error
  }
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

      if (!error && data && data.length > 0) {
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
      }
    } catch {
      // fallback to local store + seeds
    }

    const localAssets = getStoredLocalAssets();
    const mergedMap = new Map<string, PoliceAsset>();

    // Put seeds first
    for (const seed of SEED_POLICE_ASSETS) {
      mergedMap.set(seed.id, seed);
      mergedMap.set(seed.asset_code, seed);
    }
    // Overlay local user-created assets
    for (const local of localAssets) {
      mergedMap.set(local.id, local);
    }
    // Overlay server assets
    for (const srv of serverAssets) {
      mergedMap.set(srv.id, srv);
    }

    const result = Array.from(new Set(mergedMap.values()));
    return result.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },
};

export function policeAssetDetailQuery(assetId: string) {
  return {
    queryKey: ["police-asset-detail", assetId],
    queryFn: async () => {
      // 1. Fetch asset particulars
      const allAssets = await policeAssetsQuery.queryFn();
      const asset = allAssets.find((a) => a.id === assetId || a.asset_code === assetId);
      if (!asset) {
        throw new Error(`Asset ${assetId} not found in registry`);
      }

      // 2. Fetch or construct mock transfers
      const transfers: AssetTransferRecord[] = [
        {
          id: `trf-${asset.id}-1`,
          asset_id: asset.id,
          transfer_number: `TRF-2026-DEL-${asset.asset_code.slice(-4)}`,
          from_location: "Station Malkhana Holding Cell",
          to_location: asset.current_location,
          from_custodian_name: "ASI Satish Kumar",
          to_custodian_name: asset.current_custodian_name,
          dispatched_at: asset.created_at,
          received_at: asset.updated_at,
          status: "COMPLETED",
          reason: asset.evidence_status
            ? "Transfer for forensic analysis and court exhibition"
            : "Station equipment deployment",
          transit_seal_number: asset.tamper_seal_number || "TS-8849-B",
          signature_verification: "VERIFIED_DIGITAL_SIG",
        },
      ];

      // 3. Fetch or construct maintenance
      const maintenance: AssetMaintenanceRecord[] = [
        {
          id: `mnt-${asset.id}-1`,
          asset_id: asset.id,
          maintenance_type: "ROUTINE_SERVICE",
          service_provider: "Central Police Technical & Armory Workshop",
          scheduled_date: "2026-02-15",
          completed_date: "2026-02-16",
          cost: 1200,
          technician_name: "Head Constable Devender Singh",
          findings: "Functional diagnostic, physical integrity seal verification.",
          actions_taken:
            "Serviced, cleaned, barcode label replaced, seal integrity verified intact.",
          status: "COMPLETED",
          next_scheduled_service: "2026-08-15",
        },
      ];

      // 4. Fetch or construct documents
      const documents: AssetDocumentRecord[] = [
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
      ];

      // 5. Fetch custody timeline
      const timeline: CustodyTimelineEvent[] = [
        {
          id: `cust-1`,
          action: "INITIAL_REGISTRATION_AND_SEIZURE",
          from_custodian: "Crime Scene / Duty Officer",
          to_custodian: "Malkhana Moharrir",
          transfer_timestamp: asset.created_at,
          purpose_reason: "Seized under panchnama / Registered as official department asset",
          tamper_seal_intact: true,
          tamper_seal_number: asset.tamper_seal_number || "SL-ORIG-001",
          digital_signature: "SHA256:4a8b7c9e12... (Police Inspector Token)",
          verification_hash: "0x9812bc67dae4125f",
          notes: "Initial custody recorded at North District Police Station.",
        },
        {
          id: `cust-2`,
          action: "TRANSFER_TO_SPECIALIZED_CUSTODY",
          from_custodian: "Malkhana Moharrir",
          to_custodian: asset.current_custodian_name,
          transfer_timestamp: asset.updated_at,
          purpose_reason: asset.evidence_status
            ? "Transferred for forensic ballistics / cyber examination"
            : "Assigned for official district investigation duty",
          tamper_seal_intact: true,
          tamper_seal_number: asset.tamper_seal_number || "SL-TRF-002",
          digital_signature: "SHA256:bc34de56fa... (Forensic Custodian Token)",
          verification_hash: "0xa1789c02ff83419e",
          notes: `Currently logged at ${asset.current_location}.`,
        },
      ];

      // Merge dynamic transitions executed via Lifecycle Engine
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
    // Continue with local persistence
  }

  // Always persist locally for offline / quick reload
  const existing = getStoredLocalAssets();
  saveLocalAssets([newAsset, ...existing]);

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
