import {
  LayoutDashboard,
  Folder,
  Gavel,
  DoorOpen,
  CalendarDays,
  CalendarPlus,
  TriangleAlert,
  FlaskConical,
  TrendingDown,
  FileBarChart,
  FileText,
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  Gavel as GavelIcon,
  ListOrdered,
  SlidersHorizontal,
  UserCog,
  Search,
  PackageCheck,
  Scale,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { AppRole, normalizeRole } from "@/lib/rbac";

export type NavItem = {
  title: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

/** Bench (judge) accounts get a self-scoped workspace */
export const benchNavSections: NavSection[] = [
  {
    label: "Core Vault & Evidence",
    items: [
      { title: "My Bench", to: "/bench", icon: GavelIcon },
      { title: "Secure Document Vault", to: "/documents", icon: FileText },
      { title: "Evidence Exhibits", to: "/evidence", icon: PackageCheck },
      { title: "Cases", to: "/cases", icon: Folder },
      { title: "Unified Search", to: "/search", icon: Search },
      { title: "NyayaSetu Assistant", to: "/ai-assistant", icon: Sparkles },
    ],
  },
  {
    label: "Courtroom Proceedings",
    items: [
      { title: "Daily Cause List", to: "/cause-list", icon: ListOrdered },
      { title: "Calendar", to: "/calendar", icon: CalendarDays },
      { title: "Audit Trail", to: "/activity-log", icon: ScrollText },
    ],
  },
];

/** Standard Registry navigation sections */
export const navSections: NavSection[] = [
  {
    label: "Core Investigation & DMS",
    items: [
      { title: "Command Center", to: "/dashboard", icon: LayoutDashboard },
      { title: "Secure Document Vault", to: "/documents", icon: FileText },
      { title: "Evidence & Custody", to: "/evidence", icon: PackageCheck },
      { title: "Cases", to: "/cases", icon: Folder },
      { title: "Unified Search", to: "/search", icon: Search },
      { title: "Audit & Security", to: "/activity-log", icon: ScrollText },
      { title: "NyayaSetu Assistant", to: "/ai-assistant", icon: Sparkles },
    ],
  },
  {
    label: "Case & Hearing Operations",
    items: [
      { title: "Smart Scheduling", to: "/smart-scheduling", icon: CalendarPlus },
      { title: "Cause List", to: "/cause-list", icon: ListOrdered },
      { title: "Calendar", to: "/calendar", icon: CalendarDays },
      { title: "Conflict Detection", to: "/conflicts", icon: TriangleAlert },
      { title: "What-If Simulation", to: "/what-if-simulation", icon: FlaskConical },
      { title: "Backlog Simulator", to: "/backlog-simulator", icon: TrendingDown },
      { title: "Judges", to: "/judges", icon: Gavel },
      { title: "Courtrooms", to: "/courtrooms", icon: DoorOpen },
    ],
  },
  {
    label: "Evidence & Asset Management",
    items: [{ title: "Police Assets & Equipment", to: "/assets", icon: ShieldAlert }],
  },
  {
    label: "Reports & Intelligence",
    items: [
      { title: "Reports & Analytics", to: "/reports", icon: FileBarChart },
      { title: "Governance & Policies", to: "/governance", icon: ShieldCheck },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Admin Panel", to: "/admin", icon: UserCog, adminOnly: true },
      {
        title: "Priority Settings",
        to: "/priority-settings",
        icon: SlidersHorizontal,
        adminOnly: true,
      },
    ],
  },
];

/**
 * Returns role-aware navigation sections tailored to the user's specific departmental portal.
 */
export function getNavSectionsForRole(rawRole: AppRole | string | null | undefined): NavSection[] {
  const role = normalizeRole(rawRole);

  if (role === "judge") {
    return benchNavSections;
  }

  if (role === "admin") {
    return navSections;
  }

  if (role === "registrar") {
    return [
      {
        label: "Core Investigation & DMS",
        items: [
          { title: "Command Center", to: "/dashboard", icon: LayoutDashboard },
          { title: "Secure Document Vault", to: "/documents", icon: FileText },
          { title: "Evidence & Custody", to: "/evidence", icon: PackageCheck },
          { title: "Cases", to: "/cases", icon: Folder },
          { title: "Unified Search", to: "/search", icon: Search },
          { title: "Audit & Security", to: "/activity-log", icon: ScrollText },
          { title: "NyayaSetu Assistant", to: "/ai-assistant", icon: Sparkles },
        ],
      },
      {
        label: "Case & Hearing Operations",
        items: [
          { title: "Smart Scheduling", to: "/smart-scheduling", icon: CalendarPlus },
          { title: "Cause List", to: "/cause-list", icon: ListOrdered },
          { title: "Calendar", to: "/calendar", icon: CalendarDays },
          { title: "Conflict Detection", to: "/conflicts", icon: TriangleAlert },
          { title: "What-If Simulation", to: "/what-if-simulation", icon: FlaskConical },
          { title: "Backlog Simulator", to: "/backlog-simulator", icon: TrendingDown },
          { title: "Judges", to: "/judges", icon: Gavel },
          { title: "Courtrooms", to: "/courtrooms", icon: DoorOpen },
        ],
      },
      {
        label: "Reports & Intelligence",
        items: [
          { title: "Reports", to: "/reports", icon: FileBarChart },
          { title: "Governance & Policies", to: "/governance", icon: ShieldCheck },
        ],
      },
    ];
  }

  if (role === "investigating_officer") {
    return [
      {
        label: "Investigation & Documents",
        items: [
          { title: "Command Center", to: "/dashboard", icon: LayoutDashboard },
          { title: "Investigation Records & FIRs", to: "/documents", icon: FileText },
          { title: "Case Exhibits & Custody", to: "/evidence", icon: PackageCheck },
          { title: "Assigned Cases", to: "/cases", icon: Folder },
          { title: "Unified Search", to: "/search", icon: Search },
          { title: "NyayaSetu Assistant", to: "/ai-assistant", icon: Sparkles },
          { title: "Investigation Activity Log", to: "/activity-log", icon: ScrollText },
        ],
      },
      {
        label: "Tactical Equipment",
        items: [{ title: "Assigned Gear & Vehicles", to: "/assets", icon: ShieldAlert }],
      },
    ];
  }

  if (role === "forensic_officer") {
    return [
      {
        label: "Forensic Records & Custody",
        items: [
          { title: "Command Center", to: "/dashboard", icon: LayoutDashboard },
          { title: "FSL Reports & BSA §63", to: "/documents", icon: FileText },
          { title: "Evidence Under Exam", to: "/evidence", icon: PackageCheck },
          { title: "Assigned Cases", to: "/cases", icon: Folder },
          { title: "Unified Search", to: "/search", icon: Search },
          { title: "NyayaSetu Assistant", to: "/ai-assistant", icon: Sparkles },
          { title: "Forensic Chain Audit", to: "/activity-log", icon: ScrollText },
        ],
      },
      {
        label: "Lab Equipment",
        items: [{ title: "Calibration & Maintenance", to: "/assets", icon: ShieldAlert }],
      },
    ];
  }

  if (role === "evidence_custodian") {
    return [
      {
        label: "Malkhana Vault & Custody",
        items: [
          { title: "Command Center", to: "/dashboard", icon: LayoutDashboard },
          { title: "Evidence Inventory & Vault", to: "/evidence", icon: PackageCheck },
          { title: "Custody Receipts & Orders", to: "/documents", icon: FileText },
          { title: "Cases", to: "/cases", icon: Folder },
          { title: "Unified Search", to: "/search", icon: Search },
          { title: "NyayaSetu Assistant", to: "/ai-assistant", icon: Sparkles },
          { title: "Custody Transfer Ledger", to: "/activity-log", icon: ScrollText },
        ],
      },
      {
        label: "Police Assets",
        items: [{ title: "Asset Registry & Transfers", to: "/assets", icon: ShieldAlert }],
      },
    ];
  }

  if (role === "legal_officer") {
    return [
      {
        label: "Legal Vault & Filings",
        items: [
          { title: "Command Center", to: "/dashboard", icon: LayoutDashboard },
          { title: "Charge Sheets & Filings", to: "/documents", icon: FileText },
          { title: "Trial Exhibits", to: "/evidence", icon: PackageCheck },
          { title: "Assigned Cases", to: "/cases", icon: Folder },
          { title: "Unified Search", to: "/search", icon: Search },
          { title: "NyayaSetu Assistant", to: "/ai-assistant", icon: Sparkles },
          { title: "Case Filing Audit", to: "/activity-log", icon: ScrollText },
        ],
      },
      {
        label: "Court Schedules",
        items: [
          { title: "Cause List", to: "/cause-list", icon: ListOrdered },
          { title: "Trial Calendar", to: "/calendar", icon: CalendarDays },
        ],
      },
    ];
  }

  if (role === "document_officer") {
    return [
      {
        label: "Secure Document Vault",
        items: [
          { title: "Command Center", to: "/dashboard", icon: LayoutDashboard },
          { title: "Digital Document Vault", to: "/documents", icon: FileText },
          { title: "Evidence Records", to: "/evidence", icon: PackageCheck },
          { title: "Cases", to: "/cases", icon: Folder },
          { title: "Unified Search", to: "/search", icon: Search },
          { title: "NyayaSetu Assistant", to: "/ai-assistant", icon: Sparkles },
          { title: "Document Access Audit", to: "/activity-log", icon: ScrollText },
        ],
      },
      {
        label: "Intelligence & Compliance",
        items: [
          { title: "Vault & Integrity Reports", to: "/reports", icon: FileBarChart },
          { title: "Governance & Policies", to: "/governance", icon: ShieldCheck },
        ],
      },
    ];
  }

  // Default: Police Officer
  return [
    {
      label: "Core Investigation",
      items: [
        { title: "Command Center", to: "/dashboard", icon: LayoutDashboard },
        { title: "Investigation Documents", to: "/documents", icon: FileText },
        { title: "Seized Exhibits", to: "/evidence", icon: PackageCheck },
        { title: "Assigned Cases", to: "/cases", icon: Folder },
        { title: "Unified Search", to: "/search", icon: Search },
        { title: "NyayaSetu Assistant", to: "/ai-assistant", icon: Sparkles },
        { title: "Station Activity Log", to: "/activity-log", icon: ScrollText },
      ],
    },
    {
      label: "Police Assets",
      items: [{ title: "Assigned Equipment", to: "/assets", icon: ShieldAlert }],
    },
  ];
}
