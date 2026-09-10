/**
 * DEMO FIXTURES ONLY
 *
 * This file contains seed offline staff persona accounts intended strictly for
 * development, testing, and explicit DEMO_MODE demonstrations.
 *
 * ARCHITECTURAL RULE:
 * In production environments, the offline vault only permits offline access
 * for accounts that were previously authenticated online on that physical device.
 * Fictional staff personas are NEVER seeded into production browser storage.
 */

import type { OfflineStaffAccount } from "@/lib/offline-auth";

export const SEED_OFFLINE_STAFF_ACCOUNTS: OfflineStaffAccount[] = [
  {
    id: "usr_admin_01",
    email: "admin@courts.gov",
    fullName: "Shri Rajeev Verma (Principal Registrar / Admin)",
    role: "admin",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_admin",
    salt: "salt_admin_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_reg_01",
    email: "registrar@courts.gov",
    fullName: "Smt. Sunita Sharma (Chief Case Registrar)",
    role: "registrar",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_reg",
    salt: "salt_reg_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_judge_01",
    email: "judge.kapoor@delhicourts.gov",
    fullName: "Hon'ble Justice Rajesh Kapoor",
    role: "judge",
    judgeId: "demo-judge",
    judgeName: "Hon'ble Justice Rajesh Kapoor",
    passwordHash: "demo_hash_judge",
    salt: "salt_judge_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_io_01",
    email: "io.sharma@delhipolice.gov",
    fullName: "Inspector Vikramaditya Sharma (IO Spl. Cell)",
    role: "investigating_officer",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_io",
    salt: "salt_io_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_fsl_01",
    email: "fsl.mehta@cfsl.gov",
    fullName: "Dr. Ananya Mehta (Forensic Ballistics Expert)",
    role: "forensic_officer",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_fsl",
    salt: "salt_fsl_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_custodian_01",
    email: "malkhana.singh@delhipolice.gov",
    fullName: "Head Constable Surinder Singh (Malkhana Moharrir)",
    role: "evidence_custodian",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_custodian",
    salt: "salt_custodian_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_legal_01",
    email: "prosecutor.mehta@justice.gov",
    fullName: "Adv. Sanjay Mehta (Chief Public Prosecutor)",
    role: "legal_officer",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_legal",
    salt: "salt_legal_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_doc_01",
    email: "records.gupta@courts.gov",
    fullName: "Shri Alok Gupta (Chief Records & Vault Officer)",
    role: "document_officer",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_doc",
    salt: "salt_doc_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_police_01",
    email: "beat.verma@delhipolice.gov",
    fullName: "Constable Amit Verma (Beat Patrol Officer)",
    role: "police_officer",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_police",
    salt: "salt_police_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
];
