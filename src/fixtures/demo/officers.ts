/**
 * DEMO FIXTURES ONLY
 *
 * This file contains seed and demo officer profiles intended strictly for
 * development, testing, and explicit DEMO_MODE demonstrations.
 *
 * ARCHITECTURAL RULE:
 * Under NO circumstances should these records be returned in production queries,
 * global searches, or dropdown selectors when DEMO_MODE is not active.
 */

import type { OfficerProfile } from "@/lib/global-search";

export const KNOWN_OFFICERS: OfficerProfile[] = [
  {
    id: "off-01",
    name: "Inspector Vikram Rathore",
    role: "Investigating Officer (IO)",
    station: "Special Cell Police Station, Lodhi Colony",
    assignedAssetsSummary: "Assigned IO for Case BNS/2026/0014 & Exhibit EV-1045, POL-2026-DM-0811",
    assetCount: 2,
  },
  {
    id: "off-02",
    name: "Head Constable Ramesh Chand",
    role: "Malkhana Moharrir (Vault Custodian)",
    station: "District Court Central Malkhana",
    assignedAssetsSummary:
      "Custodian for Exhibit EV-1045, 9mm Pistol (Exhibit A-1), Cold Storage DNA Kits",
    assetCount: 4,
  },
  {
    id: "off-03",
    name: "Dr. Alok Verma",
    role: "Senior Scientific Officer (Forensics)",
    station: "Central Forensic Science Laboratory (CFSL), Rohini",
    assignedAssetsSummary:
      "Forensic analysis authority for Digital Media, Ballistics & Cyber extractions",
    assetCount: 3,
  },
  {
    id: "off-04",
    name: "Constable Amit Yadav",
    role: "Beat Patrol Officer",
    badgeNumber: "Badge #7481",
    station: "Kashmere Gate Police Station",
    assignedAssetsSummary: "Assigned Axon Body 3 High-Definition Camera (POL-2026-TAC-0550)",
    assetCount: 1,
  },
  {
    id: "off-05",
    name: "Sub-Inspector Deepak Sharma",
    role: "Investigating Officer (IO)",
    station: "Kotwali Police Station, Central District",
    assignedAssetsSummary: "Seizing officer for 9mm Pistol Exhibit A-1 (POL-2026-WP-0142)",
    assetCount: 1,
  },
  {
    id: "off-06",
    name: "Sub-Inspector Kuldeep Malik",
    role: "Workshop In-charge",
    station: "Central Police Motor Transport Armory Workshop",
    assignedAssetsSummary:
      "Custodian for Toyota Innova Forensic Van (POL-2026-VEH-0012) under repair",
    assetCount: 1,
  },
  {
    id: "off-07",
    name: "ASI Manjeet Kaur",
    role: "Evidence Custodian",
    station: "Civil Lines Police Station",
    assignedAssetsSummary: "Custodian for Cold Storage Biological DNA Specimen Kits",
    assetCount: 1,
  },
  {
    id: "off-08",
    name: "Inspector Harish Chander",
    role: "Narcotics Squad Custodian",
    station: "Crime Branch Narcotic Squad",
    assignedAssetsSummary: "Custodian for Malkhana Chemical Vault Contraband (POL-2026-NC-0078)",
    assetCount: 1,
  },
  {
    id: "off-09",
    name: "ACP Virender Kumar",
    role: "Assistant Commissioner of Police",
    station: "Special Cell Delhi Police",
    assignedAssetsSummary:
      "Supervisory signatory for Charge Sheets CS-2024-00491 & Section 63 BSA filings",
    assetCount: 2,
  },
];
