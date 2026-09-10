/**
 * DEMO FIXTURES ONLY
 *
 * This file contains seed facility locations intended strictly for
 * development, testing, and explicit DEMO_MODE demonstrations.
 *
 * ARCHITECTURAL RULE:
 * Under NO circumstances should these records be returned in production queries,
 * search filters, or location dropdown selectors when DEMO_MODE is not active.
 */

import type { FacilityLocation } from "@/lib/global-search";

export const KNOWN_LOCATIONS: FacilityLocation[] = [
  {
    id: "loc-01",
    name: "District Court Central Malkhana Vault B, High-Security Locker #12",
    type: "Malkhana Vault",
    district: "New Delhi District Courts Complex",
    inventorySummary: "Houses Seized Encrypted Exhibit EV-1045 under Tamper Seal #MHA-EV-1045-A",
    itemCount: 1,
  },
  {
    id: "loc-02",
    name: "State Cyber Forensic Laboratory, Rohini",
    type: "Forensic Lab",
    district: "North West Forensic Zone",
    inventorySummary:
      "Houses Seized Western Digital 4TB Surveillance Hard Drive (POL-2026-DM-0811)",
    itemCount: 1,
  },
  {
    id: "loc-03",
    name: "Tis Hazari District Court Room 4 Malkhana Safe",
    type: "Court Room",
    district: "Central District Courts",
    inventorySummary: "Houses 9mm Semi-Automatic Service Pistol (Exhibit A-1) for trial exhibition",
    itemCount: 1,
  },
  {
    id: "loc-04",
    name: "Cold Storage Biological Vault B-2",
    type: "Malkhana Vault",
    district: "Central District Malkhana",
    inventorySummary: "Houses Sterile DNA Swab Specimen Collection Kit #4 (Cryogenic Storage)",
    itemCount: 1,
  },
  {
    id: "loc-05",
    name: "Central Police Motor Transport Armory Workshop",
    type: "Armory Workshop",
    district: "District Police Lines, Kingsway Camp",
    inventorySummary:
      "Houses Mobile Forensic Crime Scene Van (POL-2026-VEH-0012) under maintenance",
    itemCount: 1,
  },
  {
    id: "loc-06",
    name: "Malkhana Secure Chemical Vault #3",
    type: "Malkhana Vault",
    district: "Crime Branch Narcotics Facility",
    inventorySummary:
      "Houses Psychotropic Contraband Consignment (4.8 kg) under Seal #MHA-NARCO-SEAL-9982",
    itemCount: 1,
  },
  {
    id: "loc-07",
    name: "Beat Patrol Station Sector 4",
    type: "Police Station",
    district: "North District Kashmere Gate",
    inventorySummary: "Active deployment location for Axon Body 3 Police Camera",
    itemCount: 1,
  },
];
