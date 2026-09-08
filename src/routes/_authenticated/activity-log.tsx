import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  Filter,
  History,
  Lock,
  Package,
  RefreshCw,
  Scale,
  ScrollText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { cn } from "@/lib/utils";
import { useCurrentStaff, usePermissions } from "@/hooks/use-current-staff";
import {
  auditLogQuery,
  formatAuditTime,
  formatRelativeAuditTime,
  type AuditDomain,
  type AuditLogEntry,
  type CanonicalAuditEventCode,
} from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/activity-log")({
  head: () => ({
    meta: [
      { title: "Universal Activity & Audit Log — NyayaSetu" },
      {
        name: "description",
        content:
          "Immutable, multi-domain audit trail covering judicial cause-lists, Secure DMS documents, police assets, evidence chain of custody, and security incidents.",
      },
      { property: "og:title", content: "Universal Activity & Audit Log — NyayaSetu" },
      {
        property: "og:description",
        content:
          "Immutable, multi-domain audit trail covering judicial cause-lists, Secure DMS documents, police assets, evidence chain of custody, and security incidents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

// Primary navigation filter domains requested by the administrator
type DomainFilter = "all" | "case" | "document" | "asset" | "evidence" | "user" | "security" | "judicial";

interface DomainTabDef {
  key: DomainFilter;
  label: string;
  icon: typeof Scale;
  description: string;
}

const DOMAIN_TABS: DomainTabDef[] = [
  {
    key: "all",
    label: "All Activity",
    icon: ScrollText,
    description: "Complete unified ledger across all judicial, DMS, and police systems",
  },
  {
    key: "case",
    label: "Cases",
    icon: Scale,
    description: "Case filings, stage transitions, hearing scheduling and cause list events",
  },
  {
    key: "document",
    label: "Documents",
    icon: FileText,
    description: "Secure DMS uploads, version creation, digital signatures, and hash audits",
  },
  {
    key: "asset",
    label: "Assets",
    icon: Package,
    description: "Police armory weapons, vehicles, body gear assignments and lifecycle changes",
  },
  {
    key: "evidence",
    label: "Evidence",
    icon: ShieldCheck,
    description: "Malkhana seizures, seals, chain-of-custody transfers, and forensic lab events",
  },
  {
    key: "user",
    label: "Users",
    icon: Users,
    description: "Staff account registrations, role elevations, and permission audits",
  },
  {
    key: "security",
    label: "Security Events",
    icon: ShieldAlert,
    description: "Integrity mismatches, tampered seals, unauthorized attempts, and lost assets",
  },
  {
    key: "judicial",
    label: "Scheduling / AI",
    icon: History,
    description: "Automated cause-list recommendations, simulations, and judge availability",
  },
];

// Specific action codes per category
const DOMAIN_ACTIONS: Record<DomainFilter, { code: string; label: string }[]> = {
  all: [],
  case: [
    { code: "CASE_REGISTERED", label: "Case Registered" },
    { code: "STAGE_TRANSITION", label: "Stage Transition" },
    { code: "HEARING_SCHEDULED", label: "Hearing Scheduled" },
    { code: "CASE_UPDATED", label: "Case Updated" },
  ],
  document: [
    { code: "UPLOADED", label: "UPLOADED" },
    { code: "VIEWED", label: "VIEWED" },
    { code: "DOWNLOADED", label: "DOWNLOADED" },
    { code: "VERSION_CREATED", label: "VERSION_CREATED" },
    { code: "SIGNED", label: "SIGNED" },
    { code: "INTEGRITY_VERIFIED", label: "INTEGRITY_VERIFIED" },
    { code: "INTEGRITY_MISMATCH", label: "INTEGRITY_MISMATCH" },
  ],
  asset: [
    { code: "CREATED", label: "CREATED" },
    { code: "ASSIGNED", label: "ASSIGNED" },
    { code: "UNASSIGNED", label: "UNASSIGNED" },
    { code: "TRANSFERRED", label: "TRANSFERRED" },
    { code: "RECEIVED", label: "RECEIVED" },
    { code: "MAINTENANCE_STARTED", label: "MAINTENANCE_STARTED" },
    { code: "MAINTENANCE_COMPLETED", label: "MAINTENANCE_COMPLETED" },
    { code: "RETURNED", label: "RETURNED" },
    { code: "RETIRED", label: "RETIRED" },
    { code: "MARKED_LOST", label: "MARKED_LOST" },
  ],
  evidence: [
    { code: "SEIZED", label: "SEIZED" },
    { code: "REGISTERED", label: "REGISTERED" },
    { code: "SEALED", label: "SEALED" },
    { code: "STORED", label: "STORED" },
    { code: "TRANSFERRED", label: "TRANSFERRED" },
    { code: "RECEIVED", label: "RECEIVED" },
    { code: "FORENSIC_STARTED", label: "FORENSIC_STARTED" },
    { code: "FORENSIC_COMPLETED", label: "FORENSIC_COMPLETED" },
    { code: "COURT_SUBMITTED", label: "COURT_SUBMITTED" },
    { code: "DISPOSED", label: "DISPOSED" },
  ],
  user: [
    { code: "ACCOUNT_CREATED", label: "ACCOUNT_CREATED" },
    { code: "ACCOUNT_ROLE_CHANGED", label: "ACCOUNT_ROLE_CHANGED" },
    { code: "PASSWORD_CHANGED", label: "PASSWORD_CHANGED" },
  ],
  security: [
    { code: "INTEGRITY_MISMATCH", label: "INTEGRITY_MISMATCH" },
    { code: "MARKED_LOST", label: "MARKED_LOST" },
    { code: "UNAUTHORIZED_ACCESS_ATTEMPT", label: "UNAUTHORIZED_ACCESS_ATTEMPT" },
    { code: "TAMPER_SEAL_COMPROMISED", label: "TAMPER_SEAL_COMPROMISED" },
  ],
  judicial: [
    { code: "SCHEDULED", label: "SCHEDULED" },
    { code: "LISTED", label: "LISTED" },
    { code: "REASSIGNED", label: "REASSIGNED" },
    { code: "SIMULATION_APPLIED", label: "SIMULATION_APPLIED" },
    { code: "AVAILABILITY_CHANGED", label: "AVAILABILITY_CHANGED" },
    { code: "SETTINGS_UPDATED", label: "SETTINGS_UPDATED" },
  ],
};

function getActionTone(code: string, isSecurity?: boolean): string {
  if (isSecurity || code === "INTEGRITY_MISMATCH" || code === "MARKED_LOST" || code.includes("UNAUTHORIZED")) {
    return "bg-destructive/15 text-destructive border-destructive/30";
  }
  if (["SIGNED", "INTEGRITY_VERIFIED", "RECEIVED", "MAINTENANCE_COMPLETED", "DISPOSED"].includes(code)) {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  }
  if (["UPLOADED", "VERSION_CREATED", "CREATED", "REGISTERED"].includes(code)) {
    return "bg-primary/10 text-primary border-primary/25";
  }
  if (["TRANSFERRED", "MAINTENANCE_STARTED", "FORENSIC_STARTED", "SEIZED"].includes(code)) {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  }
  if (["VIEWED", "DOWNLOADED", "ASSIGNED", "STORED", "COURT_SUBMITTED"].includes(code)) {
    return "bg-secondary text-secondary-foreground border-border";
  }
  return "bg-muted text-muted-foreground border-border";
}

function getDomainBadge(domain: AuditDomain | string): { label: string; tone: string; icon: typeof Scale } {
  switch (domain) {
    case "case":
      return { label: "Case", tone: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20", icon: Scale };
    case "document":
      return { label: "Secure DMS", tone: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20", icon: FileText };
    case "asset":
      return { label: "Police Asset", tone: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20", icon: Package };
    case "evidence":
      return { label: "Evidence", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", icon: ShieldCheck };
    case "security":
      return { label: "Security Alert", tone: "bg-destructive/15 text-destructive border-destructive/30", icon: ShieldAlert };
    case "user":
      return { label: "User", tone: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20", icon: Users };
    case "schedule":
    case "recommendation":
    case "simulation":
    case "availability":
    case "settings":
      return { label: "Judicial", tone: "bg-primary/10 text-primary border-primary/20", icon: History };
    default:
      return { label: "System", tone: "bg-muted text-muted-foreground border-border", icon: ScrollText };
  }
}

function Page() {
  const staff = useCurrentStaff();
  const permissions = usePermissions();
  const staffRole = staff.data?.role || "police_officer";

  const logs = useQuery({
    ...auditLogQuery,
    enabled: permissions.canViewAudit,
  });

  // Filter states
  const [selectedDomain, setSelectedDomain] = useState<DomainFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedActionCode, setSelectedActionCode] = useState("all");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const entries = useMemo(() => logs.data ?? [], [logs.data]);

  // Access Control Guard
  if (permissions.ready && !permissions.canViewAudit) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <Lock className="size-7" />
        </div>
        <Badge variant="destructive" className="mb-3 text-xs uppercase tracking-wider">
          Access Restricted — 403 Forbidden
        </Badge>
        <h2 className="text-xl font-bold text-foreground">
          Audit Trail Inspection Restricted
        </h2>
        <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
          Your current authenticated role (<strong className="text-foreground">{staffRole}</strong>) lacks <code className="font-mono text-xs">AUDIT_VIEW</code> security clearance. The central judicial audit trail is restricted to supervisory registrars, investigating officers, forensic authorities, and administrators.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Counts for each domain tab
  const domainCounts = useMemo(() => {
    const counts: Record<DomainFilter, number> = {
      all: entries.length,
      case: 0,
      document: 0,
      asset: 0,
      evidence: 0,
      user: 0,
      security: 0,
      judicial: 0,
    };

    for (const e of entries) {
      if (e.isSecurityAlert || e.domain === "security") {
        counts.security += 1;
      }
      if (e.domain === "case") counts.case += 1;
      else if (e.domain === "document") counts.document += 1;
      else if (e.domain === "asset") counts.asset += 1;
      else if (e.domain === "evidence") counts.evidence += 1;
      else if (e.domain === "user") counts.user += 1;
      else if (["schedule", "recommendation", "simulation", "availability", "settings", "registry"].includes(e.domain)) {
        counts.judicial += 1;
      }
    }

    return counts;
  }, [entries]);

  // Unique users list
  const users = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string }>();
    for (const e of entries) {
      if (e.user_id && !map.has(e.user_id)) {
        map.set(e.user_id, { id: e.user_id, name: e.userName, role: e.userRole });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  // Available action codes based on active tab
  const availableActionCodes = useMemo(() => {
    if (selectedDomain === "all") {
      const set = new Set<string>();
      for (const e of entries) {
        if (e.actionCode && e.actionCode !== "OPERATION") set.add(e.actionCode);
      }
      return Array.from(set).sort();
    }
    return DOMAIN_ACTIONS[selectedDomain].map((a) => a.code);
  }, [selectedDomain, entries]);

  // Filtered Entries
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // 1. Domain filter
      if (selectedDomain !== "all") {
        if (selectedDomain === "security") {
          if (!e.isSecurityAlert && e.domain !== "security") return false;
        } else if (selectedDomain === "judicial") {
          if (!["schedule", "recommendation", "simulation", "availability", "settings", "registry"].includes(e.domain)) {
            return false;
          }
        } else if (e.domain !== selectedDomain) {
          return false;
        }
      }

      // 2. User filter
      if (selectedUser !== "all" && e.user_id !== selectedUser) {
        return false;
      }

      // 3. Action Code filter
      if (selectedActionCode !== "all") {
        const entryCode = (e.actionCode || "").toUpperCase();
        if (!entryCode.includes(selectedActionCode.toUpperCase()) && !e.action.toUpperCase().includes(selectedActionCode.toUpperCase())) {
          return false;
        }
      }

      // 4. Case ID filter
      if (selectedCaseId.trim()) {
        const qCase = selectedCaseId.trim().toLowerCase();
        const hasCaseMatch =
          (e.caseId && e.caseId.toLowerCase().includes(qCase)) ||
          e.entity_affected.toLowerCase().includes(qCase) ||
          e.action.toLowerCase().includes(qCase);
        if (!hasCaseMatch) return false;
      }

      // 5. Date filters
      const day = e.timestamp.slice(0, 10);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;

      // 6. Free text search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const metaStr = e.metadata ? JSON.stringify(e.metadata).toLowerCase() : "";
        const match =
          e.action.toLowerCase().includes(q) ||
          e.userName.toLowerCase().includes(q) ||
          e.userRole.toLowerCase().includes(q) ||
          e.entityLabel.toLowerCase().includes(q) ||
          e.entityId.toLowerCase().includes(q) ||
          (e.caseId && e.caseId.toLowerCase().includes(q)) ||
          e.actionCode.toLowerCase().includes(q) ||
          metaStr.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [entries, selectedDomain, selectedUser, selectedActionCode, selectedCaseId, fromDate, toDate, search]);

  const activeFiltersCount =
    (selectedDomain !== "all" ? 1 : 0) +
    (selectedUser !== "all" ? 1 : 0) +
    (selectedActionCode !== "all" ? 1 : 0) +
    (selectedCaseId.trim() ? 1 : 0) +
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const resetFilters = () => {
    setSelectedDomain("all");
    setSelectedUser("all");
    setSelectedActionCode("all");
    setSelectedCaseId("");
    setFromDate("");
    setToDate("");
    setSearch("");
  };

  // Export audit trail to JSON
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filtered, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `nyayasetu_audit_trail_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyMetadata = (id: string, metadata: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10 space-y-6">
      {/* Top Header */}
      <PageHeader
        eyebrow="Compliance & Accountability"
        title="Universal Activity & Audit Log"
        description="Immutable, multi-domain audit trail across judicial scheduling, Secure DMS documents, police asset registry, malkhana evidence chain-of-custody, and security alerts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              disabled={filtered.length === 0}
              className="gap-1.5"
            >
              <Download className="size-4" />
              Export Audit Trail ({filtered.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logs.refetch()}
              disabled={logs.isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={cn("size-4", logs.isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Security Banner Alert */}
      {domainCounts.security > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="size-5 shrink-0 text-destructive animate-pulse" />
            <p className="font-medium">
              <strong className="font-bold">{domainCounts.security} Security & Integrity Events</strong> recorded in the audit trail (tamper alerts, lost assets, or unauthorized attempts).
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setSelectedDomain("security")}
            className="shrink-0 text-xs font-semibold h-8"
          >
            Filter Security Alerts
          </Button>
        </div>
      )}

      {/* 1. DOMAIN FILTER TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/80">
        {DOMAIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = domainCounts[tab.key];
          const isSelected = selectedDomain === tab.key;
          const isSecurity = tab.key === "security";

          return (
            <button
              key={tab.key}
              onClick={() => {
                setSelectedDomain(tab.key);
                setSelectedActionCode("all");
              }}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-all border shrink-0",
                isSelected
                  ? isSecurity
                    ? "bg-destructive text-destructive-foreground border-destructive shadow-xs"
                    : "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className={cn("size-3.5", isSelected ? "text-current" : isSecurity ? "text-destructive" : "text-muted-foreground")} />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono",
                  isSelected
                    ? "bg-white/20 text-current"
                    : isSecurity && count > 0
                      ? "bg-destructive/20 text-destructive"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. ADVANCED FILTER CONTROLS */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Filter className="size-3.5 text-primary" />
              Filter Records ({filtered.length} of {entries.length} displayed)
            </CardTitle>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all filters ({activeFiltersCount})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-0 pb-4 px-4 sm:px-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {/* Free Search */}
          <div className="lg:col-span-2">
            <Label htmlFor="auditSearch" className="text-[11px] font-medium text-muted-foreground">Search text / hash / seal</Label>
            <Input
              id="auditSearch"
              aria-label="Search audit log by action, title, hash, or officer"
              className="mt-1 h-9 text-xs"
              placeholder="Search action, title, hash, officer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* User Filter */}
          <div>
            <Label htmlFor="auditUser" className="text-[11px] font-medium text-muted-foreground">Actor / User</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="auditUser" aria-label="Filter audit log by actor or user" className="mt-1 h-9 text-xs">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All users ({users.length})</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">
                    {u.name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Code Filter */}
          <div>
            <Label htmlFor="auditAction" className="text-[11px] font-medium text-muted-foreground">Action Code</Label>
            <Select value={selectedActionCode} onValueChange={setSelectedActionCode}>
              <SelectTrigger id="auditAction" aria-label="Filter audit log by action code" className="mt-1 h-9 text-xs">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All actions</SelectItem>
                {availableActionCodes.map((code) => (
                  <SelectItem key={code} value={code} className="text-xs font-mono">
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Case ID Filter */}
          <div>
            <Label htmlFor="auditCaseId" className="text-[11px] font-medium text-muted-foreground">Case ID / Number</Label>
            <Input
              id="auditCaseId"
              aria-label="Filter audit log by case ID or number"
              className="mt-1 h-9 text-xs font-mono"
              placeholder="e.g. BNS/2026/0014"
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
            />
          </div>

          {/* Date Range: From / To */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Label htmlFor="auditFromDate" className="text-[11px] font-medium text-muted-foreground">From</Label>
              <Input
                id="auditFromDate"
                aria-label="Audit filter start date"
                className="mt-1 h-9 text-xs"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="auditToDate" className="text-[11px] font-medium text-muted-foreground">To</Label>
              <Input
                id="auditToDate"
                aria-label="Audit filter end date"
                className="mt-1 h-9 text-xs"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. LOG LIST / EMPTY / LOADING / ERROR STATES */}
      {logs.isLoading ? (
        <LoadingState label="Loading the platform accountability trail..." />
      ) : logs.isError ? (
        <ErrorState
          title="Could not load the Activity Log"
          error={logs.error}
          onRetry={() => logs.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={activeFiltersCount > 0 ? "No entries match your active filters" : "No recorded activity yet"}
          description={
            activeFiltersCount > 0
              ? "Widen your search term, reset the active domain tab, or expand the date range to inspect historical audit events."
              : "Uploading documents, executing asset transfers, verifying hashes, or listing hearings will appear here immediately."
          }
          action={
            activeFiltersCount > 0 ? (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing <strong className="text-foreground">{filtered.length}</strong> recorded audit event{filtered.length !== 1 ? "s" : ""}.
            </span>
            <span className="font-mono text-[11px]">
              Ledger format: RFC-6962 SHA-256 Verified
            </span>
          </div>

          <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden divide-y divide-border/60">
            {filtered.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const domainInfo = getDomainBadge(entry.domain);
              const DomainIcon = domainInfo.icon;
              const isAlert = entry.isSecurityAlert;
              const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "p-4 transition-colors",
                    isAlert ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/30",
                  )}
                >
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left: Domain icon, Badges, Action, and Entity */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                          isAlert
                            ? "bg-destructive/15 text-destructive border-destructive/30"
                            : "bg-muted text-muted-foreground border-border/60",
                        )}
                      >
                        <DomainIcon className="size-4" />
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        {/* Domain & Action Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={cn("text-[10px] font-semibold border", domainInfo.tone)}>
                            {domainInfo.label}
                          </Badge>

                          <Badge className={cn("text-[10px] font-bold font-mono border", getActionTone(entry.actionCode, isAlert))}>
                            {entry.actionCode || "OPERATION"}
                          </Badge>

                          {isAlert && (
                            <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                              <ShieldAlert className="size-2.5" />
                              Security Incident
                            </Badge>
                          )}

                          {/* State Transition Pill: Prev -> New */}
                          {(entry.previousState || entry.newState) && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-mono text-muted-foreground border border-border/60">
                              {entry.previousState ? (
                                <span className="text-foreground">{entry.previousState}</span>
                              ) : (
                                <span className="opacity-50">INITIAL</span>
                              )}
                              <ArrowRight className="size-3 opacity-60" />
                              <span className="font-bold text-foreground">{entry.newState || "UPDATED"}</span>
                            </span>
                          )}
                        </div>

                        {/* Action Text */}
                        <p className={cn("text-xs leading-relaxed font-medium", isAlert ? "text-destructive font-semibold" : "text-foreground")}>
                          {entry.action}
                        </p>

                        {/* Entity and Case ID references */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {entry.caseId && (
                            <span className="flex items-center gap-1 text-primary hover:underline font-mono">
                              <Scale className="size-3" />
                              Case: {entry.caseId}
                            </span>
                          )}

                          {entry.entityId && entry.entityId !== "—" && (
                            <span className="font-mono text-foreground/80">
                              ID: {entry.entityId}
                            </span>
                          )}

                          {entry.entityLabel && entry.entityLabel !== "—" && (
                            <span className="text-muted-foreground">
                              {entry.entityLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actor & Timestamps */}
                    <div className="shrink-0 flex flex-col items-start sm:items-end gap-1 text-xs sm:text-right">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <UserCheck className="size-3.5 text-muted-foreground" />
                        <span>{entry.userName}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono capitalize">
                        {entry.userRole.replace(/_/g, " ")}
                      </Badge>
                      <time dateTime={entry.timestamp} className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span>{formatRelativeAuditTime(entry.timestamp)}</span>
                        <span>•</span>
                        <span>{formatAuditTime(entry.timestamp)}</span>
                      </time>
                    </div>
                  </div>

                  {/* Metadata Collapsible Inspector */}
                  {hasMetadata && (
                    <div className="mt-2.5 pt-2 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          <span>{isExpanded ? "Hide Audit Metadata" : "Inspect Cryptographic & Audit Metadata"}</span>
                        </button>

                        {isExpanded && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyMetadata(entry.id, entry.metadata)}
                            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                          >
                            {copiedId === entry.id ? (
                              <>
                                <Check className="size-3 text-emerald-500" />
                                <span className="text-emerald-500">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                <span>Copy JSON</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-2 rounded-lg bg-muted/50 p-3 border border-border/60 overflow-x-auto">
                          <pre className="font-mono text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
