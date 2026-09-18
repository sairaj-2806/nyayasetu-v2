import fs from "fs";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const envText = fs.readFileSync(".env", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function seedDocuments() {
  console.log("=== Seeding Secure Document Vault Documents ===");

  // Find a valid case
  let targetCaseId = null;
  const { data: cases } = await supabase.from("cases").select("id, case_number").limit(1);
  if (cases && cases.length > 0) {
    targetCaseId = cases[0].id;
    console.log(`Linking documents to case: ${cases[0].case_number} (${targetCaseId})`);
  }

  const sampleDocs = [
    {
      id: "d1111111-1111-4111-d111-111111111111",
      case_id: targetCaseId,
      document_number: "FIR-2026-DL-00142",
      title: "First Information Report (U/S 302/120B IPC) - State v. Aman Sharma",
      category: "FIR",
      fir_number: "FIR 142/2026",
      police_station: "Connaught Place Police Station, New Delhi",
      sensitivity_tier: "PUBLIC",
      current_version: 1,
      file_name: "FIR_142_2026_Certified.pdf",
      file_format: "application/pdf",
      file_size_bytes: 428900,
      storage_path: "cases/BNS/2026/0014/documents/FIR_142_2026.pdf",
      latest_sha256: sha256("FIR text payload 142/2026 certified"),
      is_sealed: false,
      is_tampered: false,
      originating_agency: "Delhi Police Crime Branch",
      metadata: {
        police_district: "New Delhi",
        io_name: "Inspector Vikram Rathore",
        complainant: "State via Duty Officer",
        panchnama_ref: "PAN-DEL-2026-098",
      },
    },
    {
      id: "d2222222-2222-4222-d222-222222222222",
      case_id: targetCaseId,
      document_number: "CS-2026-DL-00142",
      title: "Final Charge Sheet (U/S 173 CrPC / 193 BNSS) - State v. Aman Sharma",
      category: "Charge Sheet",
      fir_number: "FIR 142/2026",
      police_station: "Connaught Place Police Station, New Delhi",
      sensitivity_tier: "RESTRICTED",
      current_version: 2,
      file_name: "Charge_Sheet_Final_Vol_1.pdf",
      file_format: "application/pdf",
      file_size_bytes: 2849100,
      storage_path: "cases/BNS/2026/0014/documents/CS_142_2026.pdf",
      latest_sha256: sha256("Charge sheet final forensic compilation v2"),
      is_sealed: false,
      is_tampered: false,
      originating_agency: "Delhi Police Special Cell",
      metadata: {
        court_name: "Chief Metropolitan Magistrate Court, Patiala House",
        prosecutor_name: "Adv. S. K. Mahajan (Spl. PP)",
      },
    },
    {
      id: "d3333333-3333-4333-d333-333333333333",
      case_id: targetCaseId,
      document_number: "FSL-2026-BAL-8819",
      title: "CFSL Cyber & Ballistic Forensic Report - Western Digital & 9mm Luger",
      category: "Forensic Report",
      fir_number: "FIR 142/2026",
      police_station: "Connaught Place Police Station, New Delhi",
      sensitivity_tier: "RESTRICTED",
      current_version: 1,
      file_name: "CFSL_Ballistic_Report_8819.pdf",
      file_format: "application/pdf",
      file_size_bytes: 5120400,
      storage_path: "cases/BNS/2026/0014/documents/CFSL_8819.pdf",
      latest_sha256: sha256("CFSL scientific ballistics concordance analysis"),
      is_sealed: false,
      is_tampered: false,
      originating_agency: "Central Forensic Science Laboratory (CFSL), Rohini",
      metadata: {
        lead_scientist: "Dr. Alok Verma (Senior Scientific Officer)",
        bsa_sec_63_certified: true,
      },
    },
    {
      id: "d4444444-4444-4444-d444-444444444444",
      case_id: targetCaseId,
      document_number: "INCAM-2026-SEAL-01",
      title: "Protected Witness Deposition & Surveillance Wiretap (In-Camera)",
      category: "In-Camera Record",
      fir_number: "FIR 142/2026",
      police_station: "Connaught Place Police Station, New Delhi",
      sensitivity_tier: "SEALED_COVER_IN_CAMERA",
      current_version: 1,
      file_name: "InCamera_Deposition_Witness_Alpha.pdf",
      file_format: "application/pdf",
      file_size_bytes: 1840200,
      storage_path: "cases/BNS/2026/0014/documents/InCamera_Alpha.pdf",
      latest_sha256: sha256("In-camera sealed cover confidential record"),
      is_sealed: true,
      is_tampered: false,
      originating_agency: "District & Sessions Judge Special Vault",
      metadata: {
        sealed_by: "Hon'ble Special Judge P. K. Saxena",
        in_camera_hearing_date: "2026-03-02",
      },
    },
  ];

  for (const doc of sampleDocs) {
    const { error: insErr } = await supabase
      .from("case_documents")
      .upsert(doc, { onConflict: "document_number" });
    if (insErr) {
      console.error(`Error inserting doc ${doc.document_number}:`, insErr.message);
    } else {
      console.log(`✓ Inserted [${doc.sensitivity_tier}] ${doc.document_number}: ${doc.title}`);
    }
  }

  const { count } = await supabase.from("case_documents").select("*", { count: "exact", head: true });
  console.log(`\nTotal documents in vault: ${count}`);
}

seedDocuments().catch((err) => {
  console.error("Seeding documents failed:", err);
  process.exit(1);
});
