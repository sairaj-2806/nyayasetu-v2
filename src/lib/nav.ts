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
    label: "My bench",
    items: [
      { title: "My Bench", to: "/bench", icon: GavelIcon },
      { title: "AI Judicial Copilot", to: "/ai-assistant", icon: Sparkles },
      { title: "Global Search", to: "/search", icon: Search },
      { title: "Cases", to: "/cases", icon: Folder },
      { title: "Digital Documents", to: "/documents", icon: FileText },
      { title: "Evidence Exhibits", to: "/evidence", icon: PackageCheck },
    ],
  },
];

/** Standard Registry navigation sections */
export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { title: "AI Judicial Copilot", to: "/ai-assistant", icon: Sparkles },
      { title: "Global Search", to: "/search", icon: Search },
      { title: "Cases", to: "/cases", icon: Folder },
    ],
  },
  {
    label: "Court Operations",
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
    label: "Secure Vault",
    items: [{ title: "Digital Documents", to: "/documents", icon: FileText }],
  },
  {
    label: "Investigation & Evidence",
    items: [{ title: "Evidence Exhibits", to: "/evidence", icon: PackageCheck }],
  },
  {
    label: "Police Assets",
    items: [{ title: "Police Assets", to: "/assets", icon: ShieldAlert }],
  },
  {
    label: "Intelligence",
    items: [{ title: "Reports", to: "/reports", icon: FileBarChart }],
  },
  {
    label: "Security & Audit",
    items: [
      { title: "Activity Log", to: "/activity-log", icon: ScrollText },
      { title: "Governance & Compliance", to: "/governance", icon: ShieldCheck },
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
        label: "Overview",
        items: [
          { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
          { title: "AI Judicial Copilot", to: "/ai-assistant", icon: Sparkles },
          { title: "Global Search", to: "/search", icon: Search },
          { title: "Cases", to: "/cases", icon: Folder },
        ],
      },
      {
        label: "Court Operations",
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
        label: "Secure Vault",
        items: [{ title: "Digital Documents", to: "/documents", icon: FileText }],
      },
      {
        label: "Evidence",
        items: [{ title: "Evidence Exhibits", to: "/evidence", icon: PackageCheck }],
      },
      {
        label: "Intelligence",
        items: [{ title: "Reports", to: "/reports", icon: FileBarChart }],
      },
      {
        label: "Security & Audit",
        items: [
          { title: "Activity Log", to: "/activity-log", icon: ScrollText },
          { title: "Governance & Compliance", to: "/governance", icon: ShieldCheck },
        ],
      },
    ];
  }

  if (role === "investigating_officer") {
    return [
      {
        label: "Overview",
        items: [
          { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
          { title: "AI Judicial Copilot", to: "/ai-assistant", icon: Sparkles },
          { title: "Global Search", to: "/search", icon: Search },
          { title: "My Cases", to: "/cases", icon: Folder },
        ],
      },
      {
        label: "Investigation & Documents",
        items: [{ title: "Investigation Records & FIRs", to: "/documents", icon: FileText }],
      },
      {
        label: "Evidence & Custody",
        items: [{ title: "Case Exhibits", to: "/evidence", icon: PackageCheck }],
      },
      {
        label: "Police Assets",
        items: [{ title: "Tactical Assets & Fleet", to: "/assets", icon: ShieldAlert }],
      },
      {
        label: "Security & Audit",
        items: [{ title: "Investigation Activity Log", to: "/activity-log", icon: ScrollText }],
      },
    ];
  }

  if (role === "forensic_officer") {
    return [
      {
        label: "Overview",
        items: [
          { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
          { title: "AI Judicial Copilot", to: "/ai-assistant", icon: Sparkles },
          { title: "Global Search", to: "/search", icon: Search },
          { title: "Cases", to: "/cases", icon: Folder },
        ],
      },
      {
        label: "Forensic Records",
        items: [{ title: "FSL Reports & BSA §63", to: "/documents", icon: FileText }],
      },
      {
        label: "Exhibits & Examination",
        items: [{ title: "Evidence Under Exam", to: "/evidence", icon: PackageCheck }],
      },
      {
        label: "Lab Equipment",
        items: [{ title: "Calibration & Maintenance", to: "/assets", icon: ShieldAlert }],
      },
      {
        label: "Security & Audit",
        items: [{ title: "Forensic Chain Audit", to: "/activity-log", icon: ScrollText }],
      },
    ];
  }

  if (role === "evidence_custodian") {
    return [
      {
        label: "Overview",
        items: [
          { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
          { title: "AI Judicial Copilot", to: "/ai-assistant", icon: Sparkles },
          { title: "Global Search", to: "/search", icon: Search },
          { title: "Cases", to: "/cases", icon: Folder },
        ],
      },
      {
        label: "Malkhana Vault",
        items: [{ title: "Evidence Inventory & Vault", to: "/evidence", icon: PackageCheck }],
      },
      {
        label: "Custody Records",
        items: [{ title: "Custody Receipts & Orders", to: "/documents", icon: FileText }],
      },
      {
        label: "Police Assets",
        items: [{ title: "Asset Registry & Transfers", to: "/assets", icon: ShieldAlert }],
      },
      {
        label: "Security & Audit",
        items: [{ title: "Custody Transfer Ledger", to: "/activity-log", icon: ScrollText }],
      },
    ];
  }

  if (role === "legal_officer") {
    return [
      {
        label: "Overview",
        items: [
          { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
          { title: "AI Judicial Copilot", to: "/ai-assistant", icon: Sparkles },
          { title: "Global Search", to: "/search", icon: Search },
          { title: "Assigned Cases", to: "/cases", icon: Folder },
        ],
      },
      {
        label: "Court Schedules",
        items: [
          { title: "Cause List", to: "/cause-list", icon: ListOrdered },
          { title: "Trial Calendar", to: "/calendar", icon: CalendarDays },
        ],
      },
      {
        label: "Legal Vault",
        items: [{ title: "Charge Sheets & Filings", to: "/documents", icon: FileText }],
      },
      {
        label: "Evidence",
        items: [{ title: "Trial Exhibits", to: "/evidence", icon: PackageCheck }],
      },
      {
        label: "Security & Audit",
        items: [{ title: "Case Filing Audit", to: "/activity-log", icon: ScrollText }],
      },
    ];
  }

  if (role === "document_officer") {
    return [
      {
        label: "Overview",
        items: [
          { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
          { title: "AI Judicial Copilot", to: "/ai-assistant", icon: Sparkles },
          { title: "Global Search", to: "/search", icon: Search },
          { title: "Cases", to: "/cases", icon: Folder },
        ],
      },
      {
        label: "Secure Vault",
        items: [{ title: "Digital Document Vault", to: "/documents", icon: FileText }],
      },
      {
        label: "Intelligence",
        items: [{ title: "Vault & Integrity Reports", to: "/reports", icon: FileBarChart }],
      },
      {
        label: "Security & Audit",
        items: [
          { title: "Document Access Audit", to: "/activity-log", icon: ScrollText },
          { title: "Governance & Policies", to: "/governance", icon: ShieldCheck },
        ],
      },
    ];
  }

  // Default: Police Officer
  return [
    {
      label: "Overview",
      items: [
        { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
        { title: "AI Judicial Copilot", to: "/ai-assistant", icon: Sparkles },
        { title: "Global Search", to: "/search", icon: Search },
        { title: "Assigned Cases", to: "/cases", icon: Folder },
      ],
    },
    {
      label: "Police Assets",
      items: [{ title: "Assigned Equipment", to: "/assets", icon: ShieldAlert }],
    },
    {
      label: "Evidence",
      items: [{ title: "Seized Exhibits", to: "/evidence", icon: PackageCheck }],
    },
    {
      label: "Security & Audit",
      items: [{ title: "Station Activity Log", to: "/activity-log", icon: ScrollText }],
    },
  ];
}
