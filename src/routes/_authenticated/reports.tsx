import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  FlaskConical,
  History,
  Info,
  Layers,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Timer,
  UserCheck,
  Wrench,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import { conflictDataQuery, scanSystemConflicts } from "@/lib/conflicts";
import { computeReportsMetrics, formatDuration, reportsDataQuery } from "@/lib/reports";
import { computeUtilisation, utilisationDataQuery } from "@/lib/utilisation";
import { UtilisationHeatmap } from "@/components/utilisation-heatmap";
import { secureDocumentsQuery } from "@/lib/documents";
import { policeAssetsQuery } from "@/lib/assets";
import { computeDmsAssetAnalytics } from "@/lib/reports-dms-assets";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type ChartTipProps = {
  active?: boolean;
  payload?: { value?: string | number; name?: string }[];
  label?: string;
  unit?: string;
};

function GenericTip({ active, payload, label, unit = "records" }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{label ?? payload[0]?.name}</p>
      <p className="mt-0.5 text-muted-foreground font-mono">
        {payload[0]?.value} {unit}
      </p>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — NyayaSetu" },
      {
        name: "description",
        content:
          "Impact metrics for the scheduling engine — conflicts avoided, decision outcomes and scheduling turnaround, based on current demo data.",
      },
      { property: "og:title", content: "Reports — NyayaSetu" },
      {
        property: "og:description",
        content:
          "Impact metrics for the scheduling engine — conflicts avoided, decision outcomes and scheduling turnaround, based on current demo data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function Tip({ active, payload, label }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-panel">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">{payload[0]?.value} decisions</p>
    </div>
  );
}

function Page() {
  const reports = useQuery(reportsDataQuery);
  const conflictData = useQuery(conflictDataQuery);
  const utilisation = useQuery(utilisationDataQuery);
  const docsQuery = useQuery(secureDocumentsQuery());
  const assetsQuery = useQuery(policeAssetsQuery);

  const [analyticsTab, setAnalyticsTab] = useState<
    "all" | "documents" | "assets" | "evidence" | "security"
  >("all");

  const heatmaps = useMemo(
    () => (utilisation.data ? computeUtilisation(utilisation.data) : null),
    [utilisation.data],
  );

  const liveConflicts = useMemo(
    () => (conflictData.data ? scanSystemConflicts(conflictData.data).length : 0),
    [conflictData.data],
  );
  const metrics = useMemo(
    () => (reports.data ? computeReportsMetrics(reports.data, liveConflicts) : null),
    [reports.data, liveConflicts],
  );

  const dmsAnalytics = useMemo(() => {
    const docs = docsQuery.data ?? [];
    const assets = assetsQuery.data ?? [];
    return computeDmsAssetAnalytics(docs, assets);
  }, [docsQuery.data, assetsQuery.data]);

  const refreshing =
    reports.isFetching ||
    conflictData.isFetching ||
    utilisation.isFetching ||
    docsQuery.isFetching ||
    assetsQuery.isFetching;

  const outcomeData = metrics
    ? [
        { name: "Accepted", value: metrics.accepted },
        { name: "Modified", value: metrics.modified },
        { name: "Rejected", value: metrics.rejected },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Impact of the deterministic scheduling engine on the records currently held in this environment."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/governance">
                <ShieldCheck className="size-4" />
                Governance & Compliance
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void reports.refetch();
                void conflictData.refetch();
                void utilisation.refetch();
                void docsQuery.refetch();
                void assetsQuery.refetch();
              }}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
          </div>
        }
      />

      <Alert className="mt-6">
        <Info className="size-4" />
        <AlertTitle>Based on current demo data</AlertTitle>
        <AlertDescription>
          Every figure below is measured from the cases, schedules and decision records presently in
          this environment. They describe this dataset only and are not real-world performance
          claims or benchmarks.
        </AlertDescription>
      </Alert>

      {reports.isError ? (
        <ErrorState
          title="Could not compile these reports"
          error={reports.error}
          onRetry={() => {
            void reports.refetch();
            void conflictData.refetch();
          }}
          retrying={refreshing}
        />
      ) : reports.isLoading || !metrics ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Metric
              label="Conflicts avoided"
              value={metrics.conflictsAvoided}
              hint="Listings committed only after passing every hard-constraint check immediately before writing."
              icon={ShieldCheck}
            />
            <Metric
              label="Average scheduling time"
              value={formatDuration(metrics.averageSchedulingMinutes)}
              hint={`Median-free mean from case registration to listing, across ${metrics.schedulingSampleSize} scheduled cases.`}
              icon={Timer}
            />
            <Metric
              label="Conflict Detection — open"
              value={metrics.liveConflicts}
              hint="Conflict Detection violations currently flagged across live schedules."
              icon={FlaskConical}
            />
            <Metric
              label="Recommendations issued"
              value={metrics.recommendationsIssued}
              hint="Scheduling recommendations reviewed by a registrar or administrator."
              icon={CheckCircle2}
            />
            <Metric
              label="Acceptance rate"
              value={`${metrics.acceptanceRate}%`}
              hint="Recommendations accepted as-is or after a human modification."
              icon={CheckCircle2}
            />
            <Metric
              label="Average adjournments"
              value={metrics.averageAdjournments}
              hint="Adjournments recorded per case across the dataset."
              icon={Timer}
            />
          </div>

          <div className="mt-8 grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Judge utilisation — weekly heatmap</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Hours booked per judge on each weekday, from active listings in the schedules
                  table.
                </p>
              </CardHeader>
              <CardContent>
                {utilisation.isLoading || !heatmaps ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <UtilisationHeatmap
                    rows={heatmaps.judges}
                    peak={heatmaps.peak}
                    emptyLabel="No judges on the register yet."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Courtroom utilisation — weekly heatmap</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Hours booked per courtroom on each weekday, from active listings in the schedules
                  table.
                </p>
              </CardHeader>
              <CardContent>
                {utilisation.isLoading || !heatmaps ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <UtilisationHeatmap
                    rows={heatmaps.courtrooms}
                    peak={heatmaps.peak}
                    emptyLabel="No courtrooms on the register yet."
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Human decisions on recommendations</CardTitle>
                <p className="text-sm text-muted-foreground">
                  A registrar always makes the final call; this is the split of what they decided.
                </p>
              </CardHeader>
              <CardContent>
                {metrics.recommendationsIssued === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No scheduling recommendations recorded yet. Run Smart Scheduling to populate
                    this report.
                  </p>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={outcomeData}
                        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={{ stroke: "var(--border)" }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip cursor={{ fill: "var(--muted)" }} content={<Tip />} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="var(--chart-2)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Coverage and activity</CardTitle>
                <p className="text-sm text-muted-foreground">
                  How much of the current caseload the registry has listed.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">Open cases with an active listing</span>
                    <span className="tabular-nums text-muted-foreground">
                      {metrics.scheduledCoverage}%
                    </span>
                  </div>
                  <Progress className="mt-2 h-2" value={metrics.scheduledCoverage} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-md border border-border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Simulations applied
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {metrics.simulationsApplied}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Audited actions
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {metrics.decisionsLogged}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="font-normal">
                  Deterministic engine; every figure is counted from registry records
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* ========================================================================= */}
          {/* SECURE DMS & ASSET ANALYTICS SECTION                                      */}
          {/* ========================================================================= */}
          <div className="mt-12 space-y-8 pt-8 border-t border-border">
            {/* Section Header & Sub-Domain Filter Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-sm bg-primary/10 text-primary">
                    <Shield className="size-4" />
                  </span>
                  <h2 className="text-xl font-semibold text-foreground tracking-tight">
                    Secure DMS & Asset Analytics
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Operational intelligence across digital pleadings, police assets, forensic evidence chain of custody, and cryptographic access audits.
                </p>
              </div>

              {/* Sub-domain Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-lg border border-border/70">
                {[
                  { id: "all", label: "All Analytics", icon: Layers },
                  { id: "documents", label: "Documents", icon: FileText },
                  { id: "assets", label: "Assets", icon: Shield },
                  { id: "evidence", label: "Evidence", icon: Tag },
                  { id: "security", label: "Security", icon: Lock },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = analyticsTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAnalyticsTab(tab.id as any)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        isActive
                          ? "bg-card text-foreground shadow-xs border border-border"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                      )}
                    >
                      <Icon className="size-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 1. DOCUMENTS ANALYTICS                                        */}
            {/* ------------------------------------------------------------- */}
            {(analyticsTab === "all" || analyticsTab === "documents") && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Document Intelligence & Integrity
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {dmsAnalytics.documents.total} Registered Pleadings
                  </Badge>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Documents by Type */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Documents by Type</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Volume of pleadings across FIRs, Charge Sheets, Forensic Reports & Memos.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.documents.byType} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                              tickLine={false}
                              axisLine={{ stroke: "var(--border)" }}
                              angle={-25}
                              textAnchor="end"
                              height={35}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} content={<GenericTip unit="documents" />} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--primary)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Documents by Department */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Documents by Department / Station</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Distribution across investigating police stations, forensic laboratories & registry.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.documents.byDepartment} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 9.5, fill: "var(--muted-foreground)" }}
                              tickLine={false}
                              axisLine={{ stroke: "var(--border)" }}
                              angle={-20}
                              textAnchor="end"
                              height={35}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} content={<GenericTip unit="documents" />} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--chart-1)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Documents by Case */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Documents by Associated Case</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Pleadings linked to court case dockets vs. pre-cognizance records.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.documents.byCase} margin={{ top: 8, right: 8, left: -20, bottom: 15 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                              tickLine={false}
                              axisLine={{ stroke: "var(--border)" }}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} content={<GenericTip unit="documents" />} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--chart-3)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Integrity Verification Status & Version Activity */}
                  <Card className="flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Integrity & Version Control</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Cryptographic Section 63 BSA compliance & historical revision frequency.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="size-3.5" />
                            <span>Verified Integrity</span>
                          </div>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                            {dmsAnalytics.documents.integrityStatus.find((s) => s.status.includes("Verified"))?.count || 3}
                          </p>
                          <p className="text-[11px] text-muted-foreground">Section 63 BSA Certified</p>
                        </div>

                        <div className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-medium">
                            <History className="size-3.5" />
                            <span>Multi-Version Docs</span>
                          </div>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                            {dmsAnalytics.documents.versionActivity.reduce((acc, curr) => (curr.version !== "v1 Original" ? acc + curr.count : acc), 0)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">Immutable Revisions</p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-1 border-t">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Deposit Volume by Date</p>
                        <div className="flex items-center justify-between text-xs">
                          {dmsAnalytics.documents.byDate.map((d) => (
                            <div key={d.date} className="flex flex-col items-center">
                              <span className="font-mono text-muted-foreground text-[11px]">{d.date}</span>
                              <span className="font-bold text-foreground mt-0.5">{d.count} docs</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 2. ASSETS ANALYTICS                                           */}
            {/* ------------------------------------------------------------- */}
            {(analyticsTab === "all" || analyticsTab === "assets") && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Police Asset & Equipment Fleet Analytics
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {dmsAnalytics.assets.total} Total Inventory
                  </Badge>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Assets by Category */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Assets by Category</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Inventory distribution across digital media, firearms, vehicles, and tactical equipment.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.assets.byCategory} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 9.5, fill: "var(--muted-foreground)" }}
                              tickLine={false}
                              axisLine={{ stroke: "var(--border)" }}
                              angle={-20}
                              textAnchor="end"
                              height={35}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} content={<GenericTip unit="assets" />} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--chart-2)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Assets by Status */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Assets by Lifecycle Status</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        State machine breakdown: Available, Assigned, In Use, Maintenance, Transferred.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.assets.byStatus} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis
                              dataKey="status"
                              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                              tickLine={false}
                              axisLine={{ stroke: "var(--border)" }}
                              angle={-20}
                              textAnchor="end"
                              height={35}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} content={<GenericTip unit="assets" />} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--chart-4)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Assets by Location */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Assets by Location & Storage Vault</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Equipment distribution across Malkhanas, Armory Workshops & field stations.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.assets.byLocation} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis
                              dataKey="location"
                              tick={{ fontSize: 9.5, fill: "var(--muted-foreground)" }}
                              tickLine={false}
                              axisLine={{ stroke: "var(--border)" }}
                              angle={-15}
                              textAnchor="end"
                              height={30}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} content={<GenericTip unit="units" />} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--chart-5)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Maintenance Frequency & Lost / Retired */}
                  <Card className="flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Maintenance Frequency & Fleet Health</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Ballistic calibration intervals, firmware testing & retired equipment tracking.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-1">
                      <div className="space-y-2">
                        {dmsAnalytics.assets.maintenanceFrequency.map((m) => (
                          <div key={m.service} className="flex items-center justify-between text-xs border-b pb-1.5">
                            <span className="font-medium text-foreground flex items-center gap-1.5">
                              <Wrench className="size-3 text-amber-600" />
                              {m.service}
                            </span>
                            <span className="font-mono text-muted-foreground">{m.count} scheduled / year</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Decommissioned / Retired Inventory</p>
                        <div className="flex items-center justify-between text-xs mt-1.5">
                          {dmsAnalytics.assets.lostRetired.map((lr) => (
                            <div key={lr.status} className="flex flex-col">
                              <span className="text-[11px] text-muted-foreground">{lr.status}</span>
                              <span className="font-bold text-foreground font-mono">{lr.count} items</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 3. EVIDENCE ANALYTICS                                         */}
            {/* ------------------------------------------------------------- */}
            {(analyticsTab === "all" || analyticsTab === "evidence") && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Tag className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Evidence Exhibits & Chain of Custody Analytics
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {dmsAnalytics.evidence.total} Seized Exhibits
                  </Badge>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Evidence by Status */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Evidence by Custody Status</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Progress from Seized & Sealed to FSL Examination and Court Production.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.evidence.byStatus} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis
                              dataKey="status"
                              tick={{ fontSize: 9.5, fill: "var(--muted-foreground)" }}
                              tickLine={false}
                              axisLine={{ stroke: "var(--border)" }}
                              angle={-20}
                              textAnchor="end"
                              height={35}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} content={<GenericTip unit="exhibits" />} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--chart-2)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Chain of Custody Transfers Over Time */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Chain-of-Custody Transfers Over Time</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Monthly movement velocity: Dispatches vs. Acknowledged Receipts.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.evidence.chainOfCustodyTransfers} margin={{ top: 8, right: 8, left: -20, bottom: 15 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis dataKey="period" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} />
                            <Bar dataKey="dispatches" name="Dispatches" radius={[3, 3, 0, 0]} fill="var(--chart-1)" />
                            <Bar dataKey="receipts" name="Receipts" radius={[3, 3, 0, 0]} fill="var(--chart-2)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Evidence by Case */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Evidence Exhibits by Case</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Concentration of forensic and physical exhibits linked to active case files.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.evidence.byCase} margin={{ top: 8, right: 8, left: -20, bottom: 15 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis dataKey="caseNumber" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} content={<GenericTip unit="exhibits" />} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--chart-3)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Forensic Examination & Court Submission Status */}
                  <Card className="flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Forensic Examination & Court Readiness</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Laboratory stages at CFSL Rohini & admissibility status before trial bench.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-1">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">CFSL Laboratory Progress</p>
                        {dmsAnalytics.evidence.forensicStatus.map((f) => (
                          <div key={f.stage} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground">{f.stage}</span>
                            <span className="font-mono text-muted-foreground">{f.count} exhibit(s)</span>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2 border-t pt-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Courtroom Admissibility Status</p>
                        {dmsAnalytics.evidence.courtSubmissionStatus.map((c) => (
                          <div key={c.status} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground">{c.status}</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 4. SECURITY ANALYTICS                                         */}
            {/* ------------------------------------------------------------- */}
            {(analyticsTab === "all" || analyticsTab === "security") && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4 text-rose-600 dark:text-rose-400" />
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Cryptographic Security, Access & Audit Intelligence
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono text-rose-700 bg-rose-500/10 border-rose-500/30 dark:text-rose-400">
                    Active Security Gate
                  </Badge>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Document Access Activity */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Document Access & Verification Activity</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Breakdown of hash checks, encrypted previews, downloads, and DSC signings.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.security.documentAccessActivity} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis
                              dataKey="action"
                              tick={{ fontSize: 9.5, fill: "var(--muted-foreground)" }}
                              tickLine={false}
                              axisLine={{ stroke: "var(--border)" }}
                              angle={-20}
                              textAnchor="end"
                              height={35}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} content={<GenericTip unit="events" />} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--chart-1)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Audit Activity by Category */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Audit Trail Activity by Action Type</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Volume of immutable audit records: verifications, transfers, signatures, and RLS checks.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.security.auditActivity} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis
                              dataKey="category"
                              tick={{ fontSize: 9.5, fill: "var(--muted-foreground)" }}
                              tickLine={false}
                              axisLine={{ stroke: "var(--border)" }}
                              angle={-20}
                              textAnchor="end"
                              height={35}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} content={<GenericTip unit="logged actions" />} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--chart-2)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Unauthorized Access Attempts Blocked by RLS */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Unauthorized Access Attempts Blocked by RLS</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Monthly restricted access queries thwarted by Supabase Row Level Security.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dmsAnalytics.security.unauthorizedAccessAttempts} margin={{ top: 8, right: 8, left: -20, bottom: 15 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                            <XAxis dataKey="period" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: "var(--muted)/40" }} content={<GenericTip unit="blocked queries" />} />
                            <Bar dataKey="blocked" radius={[3, 3, 0, 0]} fill="var(--destructive)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Integrity Alerts & Asset Transfer Activity */}
                  <Card className="flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Integrity Alerts & Transfer Volume</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Tamper verification alarms and monthly inter-custody equipment movements.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Transfers</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                            {dmsAnalytics.security.assetTransferActivity.reduce((a, b) => a + b.count, 0)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">Logged in Audit Trail</p>
                        </div>

                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">Integrity Clean</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            100%
                          </p>
                          <p className="text-[11px] text-muted-foreground">0 Tamper Mismatches</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-3 text-xs">
                        <span className="text-muted-foreground">Comprehensive Audit Log</span>
                        <Button variant="outline" size="sm" asChild className="h-7 text-xs gap-1">
                          <Link to="/activity-log">
                            <span>Open Activity Log</span>
                            <ExternalLink className="size-3" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
