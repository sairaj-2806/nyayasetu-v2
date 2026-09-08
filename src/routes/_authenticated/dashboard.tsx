import { useMemo, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileText,
  Gavel,
  History,
  Layers,
  ListChecks,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Target,
  TrendingUp,
  Trophy,
  Wrench,
  Zap,
  Folder,
  PackageCheck,
  Sparkles,
  UserCheck,
  MessageSquare,
  ScrollText,
  FileSearch,
  Scale,
  UserCog,
  FileCheck2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import { computeDashboardMetrics, dashboardDataQuery } from "@/lib/dashboard";
import { conflictDataQuery, scanSystemConflicts } from "@/lib/conflicts";
import { buildBriefingInput, composeBriefingSentences } from "@/lib/briefing";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { secureDocumentsQuery } from "@/lib/documents";
import { policeAssetsQuery } from "@/lib/assets";
import { computeDmsAndAssetMetrics } from "@/lib/dms-asset-dashboard";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { ROLE_METADATA } from "@/lib/rbac";
import { auditLogQuery, formatAuditTime } from "@/lib/audit";

function formatJudgeShortName(fullName: string): string {
  const clean = (fullName || "")
    .replace(/Hon('ble|\.)?\s*/gi, "")
    .replace(/Justice\s*/gi, "")
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "Judge";
  const firstChar = parts[0]?.[0] ?? "";
  const lastPart = parts[parts.length - 1] ?? "";
  return firstChar && lastPart ? `${firstChar}. ${lastPart}` : parts[0] || "Judge";
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NyayaSetu" },
      {
        name: "description",
        content:
          "Live registry snapshot: pending cases, high-priority listings, scheduled hearings, conflicts and utilisation.",
      },
      { property: "og:title", content: "Dashboard — NyayaSetu" },
      {
        property: "og:description",
        content:
          "Live registry snapshot: pending cases, high-priority listings, scheduled hearings, conflicts and utilisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type ChartTipProps = {
  active?: boolean;
  payload?: { name?: string; value?: string | number }[];
  label?: string;
  unit?: string;
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  to,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "gold" | "alert";
  to?: string;
  className?: string;
}) {
  const body = (
    <Card className={cn("registry-interactive h-full", className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span
          className={
            tone === "alert"
              ? "flex size-9 shrink-0 items-center justify-center rounded-sm bg-destructive/10 text-destructive"
              : tone === "gold"
                ? "flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-foreground"
                : "flex size-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-secondary-foreground"
          }
        >
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
  return to ? (
    <Link to={to} className="block focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) {
      setCount(0);
      return;
    }
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);
  return count;
}

function ImpactStat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  const displayed = useCountUp(value);
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className={cn("flex size-9 items-center justify-center rounded-sm", accent)}>
        <Icon className="size-4" />
      </span>
      <p className="text-2xl font-bold tabular-nums text-foreground">{displayed}</p>
      <p className="text-xs text-muted-foreground leading-snug">{label}</p>
    </div>
  );
}

function ImpactBanner({
  conflictsDetected,
  tier1Cases,
  recommendationsIssued,
  scheduledHearings,
  loading,
}: {
  conflictsDetected: number;
  tier1Cases: number;
  recommendationsIssued: number;
  scheduledHearings: number;
  loading: boolean;
}) {
  return (
    <Card className="registry-enter border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02]">
      <CardContent className="py-4 px-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="size-4 text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            NyayaSetu Impact
          </p>
          <span className="h-px flex-1 bg-primary/20" />
          <p className="text-[10px] text-muted-foreground">Live data from this registry</p>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ImpactStat
              label="Conflicts Detected & Prevented"
              value={conflictsDetected}
              icon={AlertTriangle}
              accent="bg-destructive/10 text-destructive"
            />
            <ImpactStat
              label="Tier 1 Cases Prioritised"
              value={tier1Cases}
              icon={Trophy}
              accent="bg-accent text-accent-foreground"
            />
            <ImpactStat
              label="AI Recommendations Issued"
              value={recommendationsIssued}
              icon={Target}
              accent="bg-primary/10 text-primary"
            />
            <ImpactStat
              label="Active Scheduled Hearings"
              value={scheduledHearings}
              icon={TrendingUp}
              accent="bg-secondary text-secondary-foreground"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChartTip({ active, payload, label, unit }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-panel">
      <p className="font-medium text-foreground">{label ?? payload[0]?.name}</p>
      <p className="text-muted-foreground">
        {payload[0]?.value} {unit}
      </p>
    </div>
  );
}

function RegistryBriefing({ sentences, pending }: { sentences: string[]; pending: boolean }) {
  return (
    <Card className="registry-enter border-l-4 border-l-primary bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-sm bg-secondary text-secondary-foreground">
            <ClipboardCheck className="size-4" />
          </span>
          Registry briefing
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : sentences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing to summarise yet — register cases and listings to build the daily briefing.
          </p>
        ) : (
          <p className="text-[0.95rem] leading-relaxed text-foreground">{sentences.join(" ")}</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Composed from live case, schedule and conflict records using fixed wording.
        </p>
      </CardContent>
    </Card>
  );
}

function CourtReadiness({
  conflicts,
  awaiting,
  tierOne,
  judgeUtilisation,
  courtroomUtilisation,
}: {
  conflicts: number;
  awaiting: number;
  tierOne: number;
  judgeUtilisation: number;
  courtroomUtilisation: number;
}) {
  const checks = [
    {
      label: "Conflict review",
      status: conflicts === 0 ? "Clear" : `${conflicts} open`,
      tone: conflicts === 0 ? "ok" : "alert",
    },
    {
      label: "Unlisted open cases",
      status: awaiting === 0 ? "Clear" : `${awaiting} pending`,
      tone: awaiting === 0 ? "ok" : "watch",
    },
    {
      label: "Tier 1 attention",
      status: tierOne === 0 ? "No Tier 1 backlog" : `${tierOne} case(s)`,
      tone: tierOne === 0 ? "ok" : "watch",
    },
    {
      label: "Bench capacity",
      status: `${judgeUtilisation}% used`,
      tone: judgeUtilisation >= 90 ? "alert" : judgeUtilisation >= 70 ? "watch" : "ok",
    },
    {
      label: "Courtroom slots",
      status: `${courtroomUtilisation}% booked`,
      tone: courtroomUtilisation >= 90 ? "alert" : courtroomUtilisation >= 70 ? "watch" : "ok",
    },
  ] as const;

  return (
    <Card className="registry-enter bg-secondary/45">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-sm bg-card text-primary">
            <ClipboardCheck className="size-4" />
          </span>
          Court readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {checks.map((check) => (
            <div
              key={check.label}
              className="registry-interactive border border-border bg-card px-3 py-3"
            >
              <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                {check.label}
              </p>
              <p
                className={
                  check.tone === "alert"
                    ? "mt-1 text-sm font-semibold text-destructive"
                    : check.tone === "watch"
                      ? "mt-1 text-sm font-semibold text-accent-foreground"
                      : "mt-1 text-sm font-semibold text-foreground"
                }
              >
                {check.status}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RoleWorkspaceFocusSection({
  role,
  metrics,
  dmsMetrics,
  conflictsCount,
}: {
  role: string;
  metrics: ReturnType<typeof computeDashboardMetrics> | null;
  dmsMetrics: ReturnType<typeof computeDmsAndAssetMetrics>;
  conflictsCount: number;
}) {
  const normRole = (role || "registrar").toLowerCase();

  const config = useMemo(() => {
    switch (normRole) {
      case "police_officer":
        return {
          title: "Police Duty & Tactical Armory Workspace",
          badge: "Law Enforcement & Field Duty",
          description:
            "Patrol vehicle fleet readiness, assigned firearms, bodycam equipment handovers, and station duty roster.",
          icon: Shield,
          accent: "text-blue-600 bg-blue-500/10 border-blue-500/30",
          cards: [
            {
              title: "Patrol Fleet & Weapons",
              value: `${dmsMetrics.assets.active} Active`,
              detail: `${dmsMetrics.assets.maintenance} units under maintenance`,
              to: "/assets",
              cta: "Open Fleet & Armory",
              icon: Shield,
            },
            {
              title: "Equipment Handovers",
              value: "Verified Protocol",
              detail: "Two-officer release & recipient acknowledgment",
              to: "/assets",
              cta: "Transfer Asset",
              icon: PackageCheck,
            },
            {
              title: "Police Incident Reports",
              value: "Private Vault",
              detail: "Station diary copies, FIRs & seizure memos",
              to: "/documents",
              cta: "View Documents",
              icon: FileText,
            },
            {
              title: "Assigned Case Duties",
              value: `${metrics?.pendingCases ?? 0} Listed`,
              detail: "Station duty roster & beat patrol",
              to: "/cases",
              cta: "View Assigned Cases",
              icon: Layers,
            },
          ],
        };

      case "investigating_officer":
        return {
          title: "Investigation & Case Officer (IO) Workspace",
          badge: "Active Criminal Investigation",
          description:
            "BNSS case diary, panchnama seizures, witness statements under Section 180, and crime scene evidence custody.",
          icon: FileSearch,
          accent: "text-amber-600 bg-amber-500/10 border-amber-500/30",
          cards: [
            {
              title: "My Investigation Cases",
              value: `${metrics?.pendingCases ?? 0} Active`,
              detail: "Track investigation stages & FIRs",
              to: "/cases",
              cta: "Open Case Dossiers",
              icon: Layers,
            },
            {
              title: "Panchnama Seizures",
              value: `${dmsMetrics.documents.total} Records`,
              detail: "Field recovery memos & digital proof",
              to: "/documents",
              cta: "Investigation Vault",
              icon: FileText,
            },
            {
              title: "Crime Scene Exhibits",
              value: "Locker Logged",
              detail: "Physical & digital seized evidence",
              to: "/evidence",
              cta: "Track Evidence",
              icon: PackageCheck,
            },
            {
              title: "Investigation Assets",
              value: `${dmsMetrics.assets.active} Deployed`,
              detail: "Body cameras, laptops & patrol vehicles",
              to: "/assets",
              cta: "Manage Equipment",
              icon: Shield,
            },
          ],
        };

      case "forensic_officer":
        return {
          title: "Forensic Science Laboratory (FSL) Workspace",
          badge: "Forensic Directorate",
          description:
            "Physical & cyber evidence intake, chemical/ballistic examination stages, chain of custody, and BSA §63 reports.",
          icon: Sparkles,
          accent: "text-purple-600 bg-purple-500/10 border-purple-500/30",
          cards: [
            {
              title: "Evidence Received at FSL",
              value: "Lab Intake Queue",
              detail: "Sealed exhibits delivered from malkhana",
              to: "/evidence",
              cta: "Review Intake Queue",
              icon: PackageCheck,
            },
            {
              title: "Examination Stages",
              value: "In Progress",
              detail: "Pending → In Examination → Completed",
              to: "/evidence",
              cta: "Update Exam Status",
              icon: Clock,
            },
            {
              title: "Cryptographic FSL Reports",
              value: "BSA §63 Proof",
              detail: "Digital signatures & SHA-256 validation",
              to: "/documents",
              cta: "Upload FSL Report",
              icon: FileText,
            },
            {
              title: "Lab Custody Return",
              value: "Chain of Custody",
              detail: "Return completed exhibits to malkhana",
              to: "/evidence",
              cta: "Custody Handover",
              icon: History,
            },
          ],
        };

      case "evidence_custodian":
        return {
          title: "Malkhana Secure Vault Workspace",
          badge: "Malkhana Custodian",
          description:
            "Biometric evidence lockers, barcoded tamper-evident seals, transfer receipt acknowledgments, and BSA-2023 compliance.",
          icon: PackageCheck,
          accent: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
          cards: [
            {
              title: "Malkhana Secure Inventory",
              value: "Biometric Lockers",
              detail: "All physical & digital sealed items",
              to: "/evidence",
              cta: "Open Inventory",
              icon: PackageCheck,
            },
            {
              title: "Pending Transfer Receipts",
              value: "Sign-Off Needed",
              detail: "Handovers awaiting recipient sign-off",
              to: "/evidence",
              cta: "Acknowledge Transfers",
              icon: CheckCircle2,
            },
            {
              title: "Seal & Hash Audits",
              value: `${dmsMetrics.documents.pendingVerification} Checks`,
              detail: "Tamper detection and hash verification",
              to: "/evidence",
              cta: "Run Seal Verification",
              icon: ShieldCheck,
            },
            {
              title: "Courtroom Production",
              value: `${metrics?.scheduledHearings ?? 0} Listed`,
              detail: "Exhibits summoned for trial today",
              to: "/cause-list",
              cta: "Cause List Exhibits",
              icon: CalendarCheck,
            },
          ],
        };

      case "legal_officer":
        return {
          title: "Prosecution & Legal Counsel Workspace",
          badge: "Public Prosecution",
          description:
            "Court filings under BNSS Section 193, charge sheets, witness lists, authorized investigation documents, and trial listings.",
          icon: Scale,
          accent: "text-indigo-600 bg-indigo-500/10 border-indigo-500/30",
          cards: [
            {
              title: "Charge Sheets & Filings",
              value: `${dmsMetrics.documents.total} Legal Docs`,
              detail: "Police final reports & court petitions",
              to: "/documents",
              cta: "Access Court Filings",
              icon: FileText,
            },
            {
              title: "Today's Listed Trials",
              value: `${metrics?.scheduledHearings ?? 0} Hearings`,
              detail: "Listed matters across all courtrooms",
              to: "/cause-list",
              cta: "View Cause List",
              icon: ListChecks,
            },
            {
              title: "Authorized Case Evidence",
              value: "Verified Exhibits",
              detail: "Physical & digital proofs ready for trial",
              to: "/evidence",
              cta: "Review Evidence",
              icon: PackageCheck,
            },
            {
              title: "Case Docket & Precedents",
              value: `${metrics?.pendingCases ?? 0} Matters`,
              detail: "Assigned criminal and civil cases",
              to: "/cases",
              cta: "Open Case Dockets",
              icon: Layers,
            },
          ],
        };

      case "document_officer":
        return {
          title: "Secure Document Vault & Records Workspace",
          badge: "Chief Records Officer",
          description:
            "Digital document repository, version control (V1..Vn), SHA-256 cryptographic integrity verification, and digital approval workflows.",
          icon: Folder,
          accent: "text-sky-600 bg-sky-500/10 border-sky-500/30",
          cards: [
            {
              title: "Encrypted Document Vault",
              value: `${dmsMetrics.documents.total} Documents`,
              detail: "15 canonical legal & police categories",
              to: "/documents",
              cta: "Open Document Vault",
              icon: FileText,
            },
            {
              title: "Cryptographic Integrity",
              value: `${Math.max(0, dmsMetrics.documents.total - dmsMetrics.documents.pendingVerification)} Verified`,
              detail: `${dmsMetrics.documents.pendingVerification} pending SHA-256 audit`,
              to: "/documents",
              cta: "Run Hash Audits",
              icon: ShieldCheck,
            },
            {
              title: "Digital Signatures",
              value: "Version Tied",
              detail: "Digital approvals tied to exact hash",
              to: "/documents",
              cta: "Pending Approvals",
              icon: FileCheck2,
            },
            {
              title: "Tamper Watchdog",
              value: `${dmsMetrics.alerts.length} Alerts`,
              detail: "Live immutable audit logs & hash logs",
              to: "/activity-log",
              cta: "View Audit Stream",
              icon: History,
            },
          ],
        };

      case "admin":
        return {
          title: "Judicial System Administration Console",
          badge: "Full Administrative RBAC",
          description:
            "User provisioning, role & permission assignments, security integrity alerts, department settings, and immutable audit logs.",
          icon: UserCog,
          accent: "text-purple-700 bg-purple-500/10 border-purple-500/30",
          cards: [
            {
              title: "Users & RBAC Roles",
              value: "Multi-Role Engine",
              detail: "Manage user permissions across 9 roles",
              to: "/admin",
              cta: "Manage Staff Accounts",
              icon: UserCheck,
            },
            {
              title: "Security Watchdog Alerts",
              value: `${dmsMetrics.alerts.length} Active`,
              detail: "Tamper detection and mismatch alerts",
              to: "/activity-log",
              cta: "Security Log",
              icon: ShieldAlert,
            },
            {
              title: "Priority & Governance",
              value: "Custom Weights",
              detail: "BNS/BNSS statutory weighting thresholds",
              to: "/priority-settings",
              cta: "Adjust Settings",
              icon: Target,
            },
            {
              title: "Immutable Audit Trail",
              value: "Full Oversight",
              detail: "Complete chronological event records",
              to: "/activity-log",
              cta: "Audit Trail",
              icon: History,
            },
          ],
        };

      case "judge":
      case "registrar":
      default:
        return {
          title: "Judicial Registry & Courtroom Operations Workspace",
          badge: normRole === "judge" ? "Judicial Bench" : "Registry Master",
          description:
            "Deterministic smart scheduling engine, daily cause list publishing, courtroom capacity solver, and conflict mitigation.",
          icon: Gavel,
          accent: "text-primary bg-primary/10 border-primary/30",
          cards: [
            {
              title: "Smart Court Scheduling",
              value: `${metrics?.awaitingScheduling ?? 0} Awaiting`,
              detail: "Multi-constraint solver with receipts",
              to: "/smart-scheduling",
              cta: "Run Scheduling Engine",
              icon: CalendarCheck,
            },
            {
              title: "Daily Cause List",
              value: `${metrics?.scheduledHearings ?? 0} Hearings`,
              detail: "Sequenced courtroom listings for today",
              to: "/cause-list",
              cta: "View Today's List",
              icon: ListChecks,
            },
            {
              title: "Conflict Detection",
              value: conflictsCount === 0 ? "Clear" : `${conflictsCount} Detected`,
              detail: "Judge, advocate & room clash mitigation",
              to: "/conflicts",
              cta: "Review Conflicts",
              icon: AlertTriangle,
            },
            {
              title: "What-If Simulation",
              value: "Digital Twin",
              detail: "Simulate judge/room/asset disruptions",
              to: "/what-if-simulation",
              cta: "Launch Simulator",
              icon: Zap,
            },
          ],
        };
    }
  }, [normRole, metrics, dmsMetrics, conflictsCount]);

  const IconComponent = config.icon;

  return (
    <Card className="border-border shadow-xs bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-9 items-center justify-center rounded-lg border", config.accent)}>
            <IconComponent className="size-4.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold text-foreground">{config.title}</CardTitle>
              <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                {config.badge}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {config.cards.map((card, idx) => {
            const CardIcon = card.icon;
            return (
              <div
                key={idx}
                className="group flex flex-col justify-between p-3.5 rounded-lg border border-border/70 bg-background/50 hover:bg-muted/40 hover:border-primary/40 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-muted-foreground">{card.title}</span>
                    <CardIcon className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-lg font-bold text-foreground tracking-tight">{card.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{card.detail}</p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/50">
                  <Button variant="ghost" size="sm" asChild className="h-7 w-full justify-between text-xs px-2 font-medium group-hover:bg-primary/10 group-hover:text-primary">
                    <Link to={card.to as any}>
                      <span>{card.cta}</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Page() {
  const data = useQuery(dashboardDataQuery);
  const conflictData = useQuery(conflictDataQuery);
  const { t } = useLanguage();
  const recsQuery = useQuery({
    queryKey: ["dashboard", "recs-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("ai_recommendations")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const docsQuery = useQuery(secureDocumentsQuery());
  const assetsQuery = useQuery(policeAssetsQuery);
  const auditQuery = useQuery(auditLogQuery);
  const staff = useCurrentStaff();
  const role = staff.data?.role || "registrar";
  const roleInfo = ROLE_METADATA[role];

  const metrics = useMemo(
    () => (data.data ? computeDashboardMetrics(data.data) : null),
    [data.data],
  );
  const conflicts = useMemo(
    () => (conflictData.data ? scanSystemConflicts(conflictData.data) : []),
    [conflictData.data],
  );

  const dmsMetrics = useMemo(() => {
    const docs = docsQuery.data ?? [];
    const assets = assetsQuery.data ?? [];
    return computeDmsAndAssetMetrics(docs, assets);
  }, [docsQuery.data, assetsQuery.data]);

  const refreshing =
    data.isFetching ||
    conflictData.isFetching ||
    docsQuery.isFetching ||
    assetsQuery.isFetching ||
    auditQuery.isFetching;

  const briefing = useMemo(() => {
    if (!data.data || !metrics || conflictData.isLoading) return null;
    return composeBriefingSentences(buildBriefingInput(data.data, metrics, conflicts));
  }, [data.data, metrics, conflicts, conflictData.isLoading]);

  const courtroomPie = useMemo(
    () => (metrics?.courtroomLoad ?? []).filter((c) => c.hearings > 0),
    [metrics?.courtroomLoad],
  );

  const totalCourtroomHearings = useMemo(
    () => courtroomPie.reduce((acc, curr) => acc + curr.hearings, 0),
    [courtroomPie],
  );

  const formattedJudgeWorkload = useMemo(() => {
    if (!metrics?.judgeWorkload) return [];
    return metrics.judgeWorkload.map((j) => ({
      ...j,
      shortName: formatJudgeShortName(j.name),
      fullName: j.name,
    }));
  }, [metrics?.judgeWorkload]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-9">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Live registry status counted directly from current case, schedule and availability records."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void data.refetch();
              void conflictData.refetch();
              void docsQuery.refetch();
              void assetsQuery.refetch();
              void auditQuery.refetch();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        }
      />

      {data.isError ? (
        <ErrorState
          title="Could not load the registry snapshot"
          error={data.error}
          onRetry={() => {
            void data.refetch();
            void conflictData.refetch();
            void auditQuery.refetch();
          }}
          retrying={refreshing}
        />
      ) : data.isLoading || !metrics ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* ROLE WORKSPACE BANNER */}
          <div className="mt-6 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Shield className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">
                    {staff.data?.fullName ? `Welcome, ${staff.data.fullName}` : "NyayaSetu Command Center"}
                  </h2>
                  <Badge variant="outline" className="text-[10px] font-semibold uppercase bg-background border-primary/30 text-primary">
                    {roleInfo?.label || "Court Registry"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {roleInfo?.description || "Central legal, police asset, forensic and judicial operations hub."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                Vault Online
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border text-[11px] font-mono text-primary">
                <ShieldCheck className="size-3" />
                BSA §63 Active
              </span>
            </div>
          </div>

          {/* TOP 6 COMMAND CENTER KPIS */}
          <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              className="registry-enter stagger-1"
              label="Active Cases"
              value={metrics.pendingCases}
              hint={`${metrics.totalCases} total on file`}
              icon={Layers}
              to="/cases"
            />
            <StatCard
              className="registry-enter stagger-2"
              label="Today's Hearings"
              value={metrics.scheduledHearings}
              hint="Listed before benches"
              icon={CalendarCheck}
              to="/calendar"
            />
            <StatCard
              className="registry-enter stagger-3"
              label="Secure Documents"
              value={dmsMetrics.documents.total}
              hint={`${dmsMetrics.documents.pendingVerification} pending audit`}
              icon={FileText}
              to="/documents"
            />
            <StatCard
              className="registry-enter stagger-4"
              label="Police Assets"
              value={dmsMetrics.assets.total}
              hint={`${dmsMetrics.assets.active} active units`}
              icon={Shield}
              to="/assets"
            />
            <StatCard
              className="registry-enter stagger-5"
              label="Evidence Items"
              value={dmsMetrics.evidence.total}
              hint={`${dmsMetrics.evidence.inCustody} sealed in vault`}
              icon={PackageCheck}
              to="/evidence"
            />
            <StatCard
              className="registry-enter stagger-6"
              label="Security Alerts"
              value={dmsMetrics.alerts.length + conflicts.length}
              hint="Tamper & conflict alerts"
              icon={AlertTriangle}
              tone={dmsMetrics.alerts.length + conflicts.length > 0 ? "alert" : "default"}
              to="/activity-log"
            />
          </div>

          {/* QUICK ACTIONS TOOLBAR */}
          <div className="mt-6 rounded-lg border border-border bg-card p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Quick Actions:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1">
                <Link to="/cases">
                  <Folder className="size-3.5" />
                  Register / View Cases
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1">
                <Link to="/smart-scheduling">
                  <CalendarCheck className="size-3.5 text-primary" />
                  Smart Scheduling
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1">
                <Link to="/cause-list">
                  <ListChecks className="size-3.5" />
                  Cause List
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1">
                <Link to="/documents">
                  <FileText className="size-3.5" />
                  Upload Document
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1">
                <Link to="/evidence">
                  <PackageCheck className="size-3.5" />
                  Evidence Vault
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1">
                <Link to="/assets">
                  <Shield className="size-3.5" />
                  Police Assets
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1">
                <Link to="/search">
                  <Search className="size-3.5" />
                  Global Search
                </Link>
              </Button>
            </div>
          </div>

          {/* ROLE-SPECIFIC WORKSPACE FOCUS PANEL */}
          <div className="mt-6">
            <RoleWorkspaceFocusSection
              role={role}
              metrics={metrics}
              dmsMetrics={dmsMetrics}
              conflictsCount={conflicts.length}
            />
          </div>

          <div className="mt-7 grid gap-4">
            <CourtReadiness
              conflicts={conflicts.length}
              awaiting={metrics.awaitingScheduling}
              tierOne={metrics.highPriorityCases}
              judgeUtilisation={metrics.judgeUtilisation}
              courtroomUtilisation={metrics.courtroomUtilisation}
            />
            <RegistryBriefing sentences={briefing ?? []} pending={briefing === null} />
            <ImpactBanner
              conflictsDetected={conflicts.length}
              tier1Cases={metrics.highPriorityCases}
              recommendationsIssued={recsQuery.data ?? 0}
              scheduledHearings={metrics.scheduledHearings}
              loading={recsQuery.isLoading}
            />
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              className="registry-enter stagger-1"
              label={t("dash.pending-cases")}
              value={metrics.pendingCases}
              hint={`${metrics.totalCases} cases on file`}
              icon={Layers}
              to="/cases"
            />
            <StatCard
              className="registry-enter stagger-2"
              label={t("dash.tier1-cases")}
              value={metrics.highPriorityCases}
              hint={`Tier 2: ${metrics.tierCounts["Tier 2"]} · Tier 3: ${metrics.tierCounts["Tier 3"]}`}
              icon={ListChecks}
              tone="gold"
              to="/cases"
            />
            <StatCard
              className="registry-enter stagger-3"
              label={t("dash.scheduled")}
              value={metrics.scheduledHearings}
              hint="Proposed or confirmed listings"
              icon={CalendarCheck}
              to="/calendar"
            />
            <StatCard
              className="registry-enter stagger-4"
              label={t("dash.conflicts")}
              value={conflictData.isLoading ? "—" : conflicts.length}
              hint="Hard-constraint violations"
              icon={AlertTriangle}
              tone={conflicts.length > 0 ? "alert" : "default"}
              to="/conflicts"
            />
            <StatCard
              className="registry-enter stagger-5"
              label={t("dash.judge-util")}
              value={`${metrics.judgeUtilisation}%`}
              hint={`Against ${metrics.judgeWorkload.length} judges × ${data.data?.maxJudgeWorkload} hearing threshold`}
              icon={Gavel}
              to="/judges"
            />
            <StatCard
              className="registry-enter stagger-1"
              label={t("dash.courtroom-util")}
              value={`${metrics.courtroomUtilisation}%`}
              hint="Booked courtroom-slot pairs of all published slots"
              icon={Building2}
              to="/courtrooms"
            />
            <StatCard
              className="registry-enter stagger-2"
              label={t("dash.awaiting")}
              value={metrics.awaitingScheduling}
              hint="Open cases with no active listing"
              icon={Clock}
              to="/smart-scheduling"
            />
            <StatCard
              label="Disposed cases"
              value={metrics.disposedCases}
              hint="Closed and off the pending list"
              icon={ListChecks}
              to="/cases"
            />
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-2 items-stretch">
            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Judge workload distribution</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Active hearings per judge (Threshold: {data.data?.maxJudgeWorkload ?? 25})
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {formattedJudgeWorkload.length} Benches
                </Badge>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center pt-2">
                {formattedJudgeWorkload.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No judges on record yet.
                  </p>
                ) : (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={formattedJudgeWorkload}
                        margin={{ top: 8, right: 8, left: -24, bottom: 24 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="shortName"
                          tick={{ fontSize: 9.5, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={{ stroke: "var(--border)" }}
                          interval={0}
                          height={44}
                          angle={-40}
                          textAnchor="end"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--muted)/40" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length || !payload[0]?.payload) return null;
                            const item = payload[0].payload as {
                              fullName?: string;
                              hearings?: number;
                            };
                            return (
                              <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                                <p className="font-semibold text-foreground">
                                  {item.fullName ?? "Judge"}
                                </p>
                                <p className="mt-0.5 text-muted-foreground">
                                  {item.hearings ?? 0} active hearing
                                  {item.hearings !== 1 ? "s" : ""}
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="hearings"
                          radius={[3, 3, 0, 0]}
                          fill="var(--primary)"
                          maxBarSize={22}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Courtroom utilisation</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Share of active listings held in each courtroom.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {courtroomPie.length} Active Halls
                </Badge>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center pt-2">
                {courtroomPie.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No courtroom bookings recorded yet.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 items-center">
                    <div className="h-60 w-full relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={courtroomPie}
                            dataKey="hearings"
                            nameKey="name"
                            innerRadius={48}
                            outerRadius={76}
                            paddingAngle={2}
                            stroke="var(--card)"
                          >
                            {courtroomPie.map((entry, i) => (
                              <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length || !payload[0]) return null;
                              const item = payload[0];
                              const val = Number(item.value) || 0;
                              const pct =
                                totalCourtroomHearings > 0
                                  ? Math.round((val / totalCourtroomHearings) * 100)
                                  : 0;
                              return (
                                <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                                  <p className="font-semibold text-foreground">
                                    {item.name ?? "Courtroom"}
                                  </p>
                                  <p className="mt-0.5 text-muted-foreground">
                                    {val} hearings ({pct}%)
                                  </p>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-bold tabular-nums text-foreground">
                          {totalCourtroomHearings}
                        </span>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                          Listings
                        </span>
                      </div>
                    </div>
                    <ScrollArea className="h-60 pr-3">
                      <ul className="space-y-2.5">
                        {courtroomPie.map((c, i) => (
                          <li key={c.name} className="text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                                />
                                <span className="truncate text-foreground font-medium">
                                  {c.name}
                                </span>
                              </span>
                              <span className="tabular-nums font-mono text-muted-foreground">
                                {c.hearings}
                              </span>
                            </div>
                            <Progress
                              className="mt-1 h-1"
                              value={Math.min(
                                100,
                                (c.hearings / Math.max(1, metrics.scheduledHearings)) * 100,
                              )}
                            />
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* SECURE DMS, POLICE ASSETS & EVIDENCE SECTION */}
          <div className="mt-9 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-sm bg-primary/10 text-primary">
                    <Shield className="size-4" />
                  </span>
                  <h2 className="text-lg font-semibold text-foreground tracking-tight">
                    Secure DMS, Police Assets & Evidence Management
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Unified registry status: tamper-evident legal records, equipment lifecycle state
                  machine, and chain of custody tracking.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1.5">
                  <Link to="/documents">
                    <FileText className="size-3.5" />
                    Document Vault
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1.5">
                  <Link to="/assets">
                    <Shield className="size-3.5" />
                    Police Assets
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1.5">
                  <Link to="/search">
                    <Search className="size-3.5" />
                    Global Search
                  </Link>
                </Button>
              </div>
            </div>

            {/* 3 Overview Cards Grid */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* 1. Secure Document Metrics */}
              <Card className="flex flex-col border-border shadow-2xs">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-sm bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <FileText className="size-4" />
                    </span>
                    <div>
                      <CardTitle className="text-sm font-semibold">Secure Documents</CardTitle>
                      <p className="text-[11px] text-muted-foreground">
                        Digital Court & Police DMS
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs font-mono bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400"
                  >
                    {dmsMetrics.documents.total} Total
                  </Badge>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        Total Documents
                      </p>
                      <p className="text-xl font-bold tabular-nums text-foreground mt-0.5">
                        {dmsMetrics.documents.total}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        Added Recently
                      </p>
                      <p className="text-xl font-bold tabular-nums text-foreground mt-0.5">
                        {dmsMetrics.documents.addedRecently}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        Pending Verification
                      </p>
                      <p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                        {dmsMetrics.documents.pendingVerification}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        Version Updates
                      </p>
                      <p className="text-xl font-bold tabular-nums text-purple-600 dark:text-purple-400 mt-0.5">
                        +{dmsMetrics.documents.versionUpdates}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-2.5 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <ShieldCheck className="size-3.5 text-emerald-600" />
                      <span>Integrity alerts</span>
                    </span>
                    {dmsMetrics.documents.integrityAlerts > 0 ? (
                      <Badge variant="destructive" className="font-mono text-[10px]">
                        {dmsMetrics.documents.integrityAlerts} Mismatch
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        All Verified
                      </span>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="w-full text-xs h-8 text-primary justify-between hover:bg-primary/5"
                  >
                    <Link to="/documents">
                      <span>Browse Document Vault</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* 2. Police Asset Metrics */}
              <Card className="flex flex-col border-border shadow-2xs">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-sm bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Shield className="size-4" />
                    </span>
                    <div>
                      <CardTitle className="text-sm font-semibold">Police Assets</CardTitle>
                      <p className="text-[11px] text-muted-foreground">
                        Equipment & Fleet Lifecycle
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs font-mono bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-400"
                  >
                    {dmsMetrics.assets.total} Total
                  </Badge>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        Active Units
                      </p>
                      <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {dmsMetrics.assets.active}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        Assigned
                      </p>
                      <p className="text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
                        {dmsMetrics.assets.assigned}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        Maintenance
                      </p>
                      <p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                        {dmsMetrics.assets.maintenance}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        Transfer / Handover
                      </p>
                      <p className="text-xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {dmsMetrics.assets.transfer}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-2.5 text-xs">
                    <span className="text-muted-foreground">Lost / Retired items</span>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {dmsMetrics.assets.lostRetired} items
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="w-full text-xs h-8 text-primary justify-between hover:bg-primary/5"
                  >
                    <Link to="/assets">
                      <span>Open Asset Inventory</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* 3. Evidence Metrics */}
              <Card className="flex flex-col border-border shadow-2xs">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Tag className="size-4" />
                    </span>
                    <div>
                      <CardTitle className="text-sm font-semibold">Evidence & Custody</CardTitle>
                      <p className="text-[11px] text-muted-foreground">
                        Case Exhibits & Chain of Custody
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs font-mono bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                  >
                    {dmsMetrics.evidence.total} Exhibits
                  </Badge>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        In Custody Vault
                      </p>
                      <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {dmsMetrics.evidence.inCustody}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        Under Forensic Exam
                      </p>
                      <p className="text-xl font-bold tabular-nums text-purple-600 dark:text-purple-400 mt-0.5">
                        {dmsMetrics.evidence.forensicExam}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        Court Submission
                      </p>
                      <p className="text-xl font-bold tabular-nums text-sky-600 dark:text-sky-400 mt-0.5">
                        {dmsMetrics.evidence.awaitingCourtSubmission}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        Custody Alerts
                      </p>
                      <p className="text-xl font-bold tabular-nums text-destructive mt-0.5">
                        {dmsMetrics.evidence.custodyAlerts}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-2.5 text-xs">
                    <span className="text-muted-foreground">Active Tamper Seals</span>
                    <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      100% Intact
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="w-full text-xs h-8 text-primary justify-between hover:bg-primary/5"
                  >
                    <Link to="/assets">
                      <span>View Chain of Custody</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* 4. Security & Integrity Alerts Section */}
            <Card className="border-border shadow-2xs">
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-sm bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="size-4" />
                  </span>
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      Security & Integrity Alerts
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      Real-time watchdog: tamper alerts, unauthorized access attempts, overdue
                      transfers, and maintenance alerts.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-400 font-medium"
                  >
                    {dmsMetrics.alerts.length} Active Notice
                    {dmsMetrics.alerts.length !== 1 ? "s" : ""}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Link to="/activity-log">Audit Logs</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="divide-y divide-border">
                  {dmsMetrics.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide",
                              alert.severity === "CRITICAL"
                                ? "bg-destructive/15 text-destructive border-destructive/30"
                                : alert.severity === "HIGH"
                                  ? "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-400"
                                  : alert.severity === "WARNING"
                                    ? "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400"
                                    : "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400",
                            )}
                          >
                            {alert.severity}
                          </span>
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {alert.targetCode}
                          </span>
                          <span className="text-xs font-medium text-foreground">{alert.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80">
                          <span>Logged: {alert.timestamp}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-7 text-xs font-medium gap-1 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                        >
                          <Link to={alert.route as any} params={alert.routeParams as any}>
                            <span>{alert.actionLabel}</span>
                            <ExternalLink className="size-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 5. Live Recent Audit Activity & AI Assistant Intelligence Spotlight */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Live Audit Activity */}
              <Card className="border-border shadow-2xs">
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-sm bg-secondary text-secondary-foreground">
                      <History className="size-4" />
                    </span>
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        Live Platform Audit Trail
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground">
                        Real-time immutable chronological audit of case actions, transfers & integrity checks.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild className="h-7 text-xs font-medium">
                    <Link to="/activity-log">
                      <span>View Full Trail</span>
                      <ExternalLink className="size-3 ml-1" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="pt-1">
                  {auditQuery.isLoading ? (
                    <div className="space-y-3 py-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : !auditQuery.data || auditQuery.data.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No recent audit events recorded.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {auditQuery.data.slice(0, 5).map((log) => (
                        <div key={log.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-xs">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                                {log.domain}
                              </Badge>
                              <span className="font-semibold text-foreground truncate">
                                {log.action}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {log.entityLabel || log.entity_affected} • By <span className="font-medium text-foreground">{log.userName}</span> ({log.userRole})
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground/80 font-mono">
                            {formatAuditTime(log.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Assistant & Copilot Queries */}
              <Card className="border-border shadow-2xs bg-gradient-to-br from-card via-card to-primary/[0.03]">
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-sm bg-primary/10 text-primary">
                      <Sparkles className="size-4" />
                    </span>
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        NyayaSetu AI Assistant & Copilot
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground">
                        Live grounded intelligence across cases, cause-lists, documents, custody & assets.
                      </p>
                    </div>
                  </div>
                  <Button size="sm" asChild className="h-7 text-xs font-medium gap-1">
                    <Link to={"/ai-assistant" as any}>
                      <span>Open Copilot</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Try asking common legal, police and judicial questions directly verified against current database records:
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      {
                        prompt: "Summarize Case BNS/2026/0014 and its critical evidence.",
                        badge: "Case Dossier",
                      },
                      {
                        prompt: "Where is evidence EV-1045 and what is its chain of custody?",
                        badge: "Malkhana",
                      },
                      {
                        prompt: "Which police assets are currently under maintenance or transferred?",
                        badge: "Armory & Fleet",
                      },
                      {
                        prompt: "List documents awaiting digital signature or SHA-256 integrity verification.",
                        badge: "DMS Vault",
                      },
                      {
                        prompt: "Which hearings are listed for today across all courtrooms?",
                        badge: "Cause List",
                      },
                    ].map((item, idx) => (
                      <Link
                        key={idx}
                        to={"/ai-assistant" as any}
                        className="group flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-background/60 hover:bg-accent/15 hover:border-primary/40 transition-all text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MessageSquare className="size-3.5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="font-medium text-foreground truncate">{item.prompt}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0 font-normal">
                          {item.badge}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
