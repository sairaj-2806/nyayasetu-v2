/**
 * DEMO FIXTURES ONLY
 *
 * This file contains seed audit trail records intended strictly for
 * development, testing, and explicit DEMO_MODE demonstrations.
 *
 * ARCHITECTURAL RULE:
 * Under NO circumstances should these records be returned in production queries,
 * global searches, or audit ledger views when DEMO_MODE is not active.
 */

import type { UnifiedAuditItem } from "@/lib/global-search";

export const SEED_AUDIT_TRAIL: UnifiedAuditItem[] = [
  {
    id: "aud-01",
    action:
      "Evidence Receipt Acknowledged & Digitally Signed with SHA-256 Manifest (Exhibit EV-1045)",
    entityAffected: "asset:ast-seed-007 transfer:TRF-2026-DEL-1045",
    userName: "Head Constable Ramesh Chand",
    userRole: "registrar",
    timestamp: "2026-03-01T11:00:00Z",
    caseNumber: "BNS/2026/0014",
    actionType: "evidence",
  },
  {
    id: "aud-02",
    action: "Document Integrity Verified under Section 63 BSA 2023 (Charge Sheet Vol 1 v2)",
    entityAffected: "document:doc_cs_01 version:v2",
    userName: "Registrar Bench Clerk",
    userRole: "registrar",
    timestamp: "2026-03-02T15:30:00Z",
    caseNumber: "CR/2024/00491",
    actionType: "document",
  },
  {
    id: "aud-03",
    action: "CFSL Forensic Device & Cryptographic Extraction Report Registered for Exhibit EV-1045",
    entityAffected: "document:doc_bns_fsl_01 exhibit:EV-1045",
    userName: "Dr. Alok Verma",
    userRole: "registrar",
    timestamp: "2026-02-28T16:00:00Z",
    caseNumber: "BNS/2026/0014",
    actionType: "document",
  },
  {
    id: "aud-04",
    action: "Panchnama Seizure Memo Recorded & Tamper Seal #MHA-EV-1045-A Applied",
    entityAffected: "asset:ast-seed-007 memo:DOC-2026-SZ-0014",
    userName: "Sub-Inspector Deepak Sharma",
    userRole: "police_staff",
    timestamp: "2026-02-14T14:15:00Z",
    caseNumber: "BNS/2026/0014",
    actionType: "evidence",
  },
  {
    id: "aud-05",
    action: "Initial First Information Report Registered U/S 111/318 BNS (FIR No. 28/2026)",
    entityAffected: "case:case-bns-0014 document:doc_bns_fir_01",
    userName: "Inspector Vikram Rathore",
    userRole: "police_staff",
    timestamp: "2026-02-14T09:00:00Z",
    caseNumber: "BNS/2026/0014",
    actionType: "case",
  },
];
