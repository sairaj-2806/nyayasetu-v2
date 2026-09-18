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

async function seed() {
  console.log("=== Seeding Police Assets & Evidence Registry ===");

  // 1. Fetch categories
  const { data: categories, error: catErr } = await supabase
    .from("asset_categories")
    .select("id, code");
  if (catErr || !categories?.length) {
    throw new Error("Failed to fetch asset categories: " + catErr?.message);
  }

  const categoryMap = new Map(categories.map((c) => [c.code, c.id]));
  console.log("Found categories:", Array.from(categoryMap.keys()));

  // 2. Fetch or create a reference case for BNS/2026/0014
  let case0014 = null;
  const { data: existingCase } = await supabase
    .from("cases")
    .select("id, case_number")
    .ilike("case_number", "%0014%")
    .limit(1);

  if (existingCase && existingCase.length > 0) {
    case0014 = existingCase[0].id;
  } else {
    // Create reference case
    const caseId = crypto.randomUUID();
    const { error: caseInsertErr } = await supabase.from("cases").insert({
      id: caseId,
      case_number: "BNS/2026/0014",
      cnr_number: "DLCT01-000014-2026",
      parties: "State of NCT vs. Aman Sharma & Ors.",
      filing_date: "2026-02-14",
      status: "scheduled",
      priority_score: 85,
      priority_tier: "Tier 1",
      estimated_duration_minutes: 60,
    });
    if (!caseInsertErr) {
      case0014 = caseId;
      console.log("Created reference case BNS/2026/0014:", case0014);
    }
  }

  // 3. Fetch reference profiles if available
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").limit(5);
  const defaultCustodianId = profiles?.[0]?.id || null;

  // 4. Asset definitions to seed
  const assetsToSeed = [
    {
      id: "a1111111-1111-4111-a111-111111111111",
      asset_code: "POL-2026-DM-0811",
      name: "Seized Western Digital 4TB Surveillance Hard Drive",
      category_id: categoryMap.get("DIGITAL_MEDIA"),
      status: "IN_USE",
      evidence_status: "FORENSIC_EXAMINATION",
      condition: "EXCELLENT",
      current_location: "State Cyber Forensic Laboratory, Rohini",
      department_station: "Cyber Crime Police Station, North District",
      current_custodian_name: "Dr. Alok Verma (Senior Scientific Officer)",
      assigned_officer_name: "Inspector Vikram Rathore",
      case_id: case0014,
      fir_number: "FIR No. 142/2026 U/S 420/467/471 IPC",
      serial_number: "WDC-WD40PURZ-882109",
      barcode_rfid: "RFID-IND-DEL-98421",
      tamper_seal_number: "MHA-SL-2026-8831",
      purchase_date: "2026-01-14",
      purchase_cost: 9500,
      vendor_supplier: "State Forensic Repository / Seizure",
      warranty_expiry: "2028-01-14",
      metadata: { seizure_officer: "Inspector Vikram Rathore", bsa_compliant: true },
    },
    {
      id: "a2222222-2222-4222-a222-222222222222",
      asset_code: "POL-2026-WP-0142",
      name: "9mm Semi-Automatic Service Pistol (Exhibit A-1)",
      category_id: categoryMap.get("WEAPONS"),
      status: "TRANSFERRED",
      evidence_status: "COURT_SUBMISSION",
      condition: "GOOD",
      current_location: "Tis Hazari District Court Room 4 Malkhana Safe",
      department_station: "Kotwali Police Station, Central District",
      current_custodian_name: "Head Constable Ramesh Chand (Malkhana Moharrir)",
      assigned_officer_name: "Sub-Inspector Deepak Sharma",
      case_id: case0014,
      fir_number: "FIR No. 89/2026 U/S 25/27 Arms Act",
      serial_number: "IOF-9MM-2021-994",
      barcode_rfid: "RFID-IND-DEL-44102",
      tamper_seal_number: "COURT-EV-8841-B",
      purchase_date: "2025-11-20",
      purchase_cost: 65000,
      vendor_supplier: "Indian Ordnance Factory (Seized)",
      warranty_expiry: null,
      metadata: { ballistics_tested: true, malkhana_register_ref: "VOL-IV-P12" },
    },
    {
      id: "a3333333-3333-4333-a333-333333333333",
      asset_code: "POL-2026-BIO-0932",
      name: "Sterile DNA Swab Specimen Collection Kit #4",
      category_id: categoryMap.get("BIOLOGICAL"),
      status: "AVAILABLE",
      evidence_status: "STORED",
      condition: "NEW",
      current_location: "Cold Storage Biological Vault B-2",
      department_station: "Civil Lines Police Station",
      current_custodian_name: "ASI Manjeet Kaur",
      assigned_officer_name: "Inspector Neha Singh",
      case_id: case0014,
      fir_number: "FIR No. 204/2026 U/S 376 IPC & POCSO Act",
      serial_number: "DNA-SPEC-2026-041",
      barcode_rfid: "RFID-BIO-2026-004",
      tamper_seal_number: "FORENSIC-CRYO-9011",
      purchase_date: "2026-02-01",
      purchase_cost: 3200,
      vendor_supplier: "Himedia Forensics Pvt Ltd",
      warranty_expiry: "2027-02-01",
      metadata: { storage_temp: "-20C", cold_chain_verified: true },
    },
    {
      id: "a4444444-4444-4444-a444-444444444444",
      asset_code: "POL-2026-NC-0078",
      name: "Seized Psychotropic Contraband Consignment (4.8 kg)",
      category_id: categoryMap.get("NARCOTICS"),
      status: "REGISTERED",
      evidence_status: "SEALED",
      condition: "EXCELLENT",
      current_location: "Malkhana Secure Chemical Vault #3",
      department_station: "Crime Branch Narcotic Squad",
      current_custodian_name: "Inspector Harish Chander",
      assigned_officer_name: "Sub-Inspector Sandeep Nain",
      case_id: case0014,
      fir_number: "FIR No. 45/2026 U/S 21/29 NDPS Act",
      serial_number: "NDPS-SEAL-2026-788",
      barcode_rfid: "RFID-NDPS-8877",
      tamper_seal_number: "MHA-NARCO-SEAL-9982",
      purchase_date: "2026-02-10",
      purchase_cost: null,
      vendor_supplier: "Seized Article / NCB",
      warranty_expiry: null,
      metadata: { sampling_done: true, chemical_analysis_pending: true },
    },
    {
      id: "a5555555-5555-4555-a555-555555555555",
      asset_code: "EV-1045",
      name: "Seized Encrypted Samsung Galaxy S24 Ultra (Exhibit EV-1045)",
      category_id: categoryMap.get("DIGITAL_MEDIA"),
      status: "IN_USE",
      evidence_status: "STORED",
      condition: "EXCELLENT",
      current_location: "District Court Central Malkhana Vault B, High-Security Locker #12",
      department_station: "Special Cell Police Station, Lodhi Colony",
      current_custodian_name: "Head Constable Ramesh Chand (Malkhana Moharrir)",
      assigned_officer_name: "Inspector Vikram Rathore",
      case_id: case0014,
      fir_number: "FIR No. 28/2026 U/S 111/318 BNS",
      serial_number: "SM-S928B-IMEI-882910",
      barcode_rfid: "RFID-EV-1045",
      tamper_seal_number: "MHA-EV-1045-A",
      purchase_date: "2026-02-14",
      purchase_cost: null,
      vendor_supplier: "Seized Evidence Exhibit / Panchnama",
      warranty_expiry: null,
      metadata: { bsa_certificate_63: true, forensic_hash_verified: true },
    },
    {
      id: "a6666666-6666-4666-a666-666666666666",
      asset_code: "EV-1046",
      name: "SanDisk Extreme 2TB Rugged External SSD (Exhibit EV-1046)",
      category_id: categoryMap.get("DIGITAL_MEDIA"),
      status: "IN_USE",
      evidence_status: "STORED",
      condition: "GOOD",
      current_location: "District Court Central Malkhana Vault B, High-Security Locker #12",
      department_station: "Special Cell Police Station, Lodhi Colony",
      current_custodian_name: "Head Constable Ramesh Chand (Malkhana Moharrir)",
      assigned_officer_name: "Inspector Vikram Rathore",
      case_id: case0014,
      fir_number: "FIR No. 28/2026 U/S 111/318 BNS",
      serial_number: "SNDK-E61-2TB-77412",
      barcode_rfid: "RFID-EV-1046",
      tamper_seal_number: "MHA-EV-1046-B",
      purchase_date: "2026-02-14",
      purchase_cost: null,
      vendor_supplier: "Seized Evidence Exhibit / Panchnama",
      warranty_expiry: null,
      metadata: { bitstream_image_taken: true, sha256_verified: true },
    },
    {
      id: "a7777777-7777-4777-a777-777777777777",
      asset_code: "POL-2026-TAC-0550",
      name: "Axon Body 3 High-Definition Police Body Camera",
      category_id: categoryMap.get("COMM_GEAR"),
      status: "ASSIGNED",
      evidence_status: null,
      condition: "GOOD",
      current_location: "Beat Patrol Station Sector 4",
      department_station: "Kashmere Gate Police Station",
      current_custodian_name: "Head Constable Suraj Bhan",
      assigned_officer_name: "Constable Amit Yadav (Badge #7481)",
      case_id: null,
      fir_number: null,
      serial_number: "AXN-B3-889104",
      barcode_rfid: "BAR-AXON-889104",
      tamper_seal_number: null,
      purchase_date: "2025-08-10",
      purchase_cost: 42000,
      vendor_supplier: "Axon Enterprise India Ltd",
      warranty_expiry: "2028-08-10",
      metadata: { battery_cycles: 42, firmware_version: "v4.2.1" },
    },
    {
      id: "a8888888-8888-4888-a888-888888888888",
      asset_code: "POL-2026-VEH-0012",
      name: "Toyota Innova Crysta Mobile Forensic Van",
      category_id: categoryMap.get("VEHICLES"),
      status: "AVAILABLE",
      evidence_status: null,
      condition: "GOOD",
      current_location: "Central Police Motor Transport Workshop",
      department_station: "District Police Lines, Kingsway Camp",
      current_custodian_name: "Sub-Inspector Kuldeep Malik",
      assigned_officer_name: "Inspector Rajesh Dahiya",
      case_id: null,
      fir_number: null,
      serial_number: "DL-1CAA-4921",
      barcode_rfid: "RFID-VEH-DL1CAA4921",
      tamper_seal_number: null,
      purchase_date: "2024-03-22",
      purchase_cost: 2150000,
      vendor_supplier: "Toyota Kirloskar Motor Pvt Ltd",
      warranty_expiry: "2027-03-22",
      metadata: { odometer_km: 18450, service_due_km: 20000 },
    },
  ];

  console.log(`Upserting ${assetsToSeed.length} police assets & evidence exhibits...`);
  for (const item of assetsToSeed) {
    const { error: insertErr } = await supabase
      .from("police_assets")
      .upsert(item, { onConflict: "asset_code" });
    if (insertErr) {
      console.error(`Error inserting asset ${item.asset_code}:`, insertErr.message);
    } else {
      console.log(`✓ Inserted ${item.asset_code}: ${item.name}`);
    }
  }

  // 5. Seed initial evidence custody records
  console.log("\nSeeding initial custody records...");
  const custodyEvents = [
    {
      id: crypto.randomUUID(),
      asset_id: "a1111111-1111-4111-a111-111111111111",
      case_id: case0014,
      action: "SEIZED_AT_SCENE",
      from_custodian: "Crime Scene Recovery Team",
      to_custodian: "Inspector Vikram Rathore",
      purpose_reason: "Seized under official panchnama at crime scene",
      tamper_seal_intact: true,
      tamper_seal_number: "MHA-SL-2026-8831",
      digital_signature: "ECDSA-P256:4a8b7c9e12...",
      verification_hash: "0x9812bc67dae4125f4b3e8912cd76ea0124fe",
      notes: "In-situ recovery documented in formal seizure memo under BSA 2023 §63.",
    },
    {
      id: crypto.randomUUID(),
      asset_id: "a1111111-1111-4111-a111-111111111111",
      case_id: case0014,
      action: "REGISTERED_AND_SEALED",
      from_custodian: "Inspector Vikram Rathore",
      to_custodian: "Head Constable Ramesh Chand (Malkhana Moharrir)",
      purpose_reason: "Formal cataloging in police FIR & property register",
      tamper_seal_intact: true,
      tamper_seal_number: "MHA-SL-2026-8831",
      digital_signature: "ECDSA-P256:bc34de56fa...",
      verification_hash: "0xa1789c02ff83419e78ad1234bc56ef980123",
      notes: "Secured in high-security malkhana evidence locker.",
    },
    {
      id: crypto.randomUUID(),
      asset_id: "a1111111-1111-4111-a111-111111111111",
      case_id: case0014,
      action: "FORENSIC_EXAMINATION",
      from_custodian: "Head Constable Ramesh Chand (Malkhana Moharrir)",
      to_custodian: "Dr. Alok Verma (Senior Scientific Officer)",
      purpose_reason: "Transferred for digital analysis at State Cyber Forensic Laboratory",
      tamper_seal_intact: true,
      tamper_seal_number: "MHA-SL-2026-8831",
      digital_signature: "ECDSA-P256:ef780123cd...",
      verification_hash: "0x546312a0bf29871e98cd4567ab12ef345678",
      notes: "Current forensic custody verification confirmed.",
    },
  ];

  for (const ev of custodyEvents) {
    await supabase.from("evidence_chain_of_custody").insert(ev);
  }
  console.log(`✓ Inserted ${custodyEvents.length} custody timeline events`);

  // 6. Verification
  const { data: verifiedAssets } = await supabase
    .from("police_assets")
    .select("id, asset_code, name, evidence_status");
  console.log(`\nVerified ${verifiedAssets?.length} assets in database:`);
  for (const a of verifiedAssets || []) {
    console.log(` - ${a.asset_code} | Evidence: ${a.evidence_status || 'N/A'} | ${a.name}`);
  }
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
