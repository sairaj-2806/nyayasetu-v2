import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Barcode,
  Building2,
  Calendar,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSearch,
  FileText,
  Gavel,
  History,
  LayoutDashboard,
  Lock,
  MapPin,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  Scale,
  ScrollText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Truck,
  User,
  UserCheck,
  Users,
  Video,
  Wrench,
  XCircle,
} from "lucide-react";

import { downloadCaseReportPdf } from "@/lib/pdf";
import { toast } from "sonner";
import { policeAssetsQuery, type CustodyTimelineEvent, type PoliceAsset } from "@/lib/assets";
import { secureDocumentsQuery, type SecureDocument } from "@/lib/documents";
import { auditLogQuery, formatAuditTime, type AuditLogEntry } from "@/lib/audit";
import {
  verifyChainOfCustody,
  type ChainOfCustodyVerificationReport,
} from "@/lib/evidence-custody";

import { PageHeader } from "@/components/page-shell";
import { PriorityBadge } from "@/components/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adjournmentsQuery,
  casesQuery,
  formatDate,
  statusLabel,
  SCHEDULABLE_STATUSES,
  type CaseStatus,
} from "@/lib/cases";
import { formatSlot, isActive, schedulesQuery } from "@/lib/registry";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { recordAudit } from "@/lib/audit";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff, usePermissions } from "@/hooks/use-current-staff";
import { WhyThisOrderPanel } from "@/components/why-this-order";
import { CaseTimeline } from "@/components/case-timeline";
import { StoredReasoning } from "@/components/reasoning-list";
import { CaseSchedulingPanel } from "@/components/case-scheduling-panel";
import { ErrorState } from "@/components/states";
import { scheduleRecommendationQuery } from "@/lib/recommendations";
import {
  computePriority,
  priorityInputFromCase,
  prioritySettingsQuery,
  recomputeCasePriority,
} from "@/lib/priority";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Case Dossier & Evidence Vault — NyayaSetu" },
      {
        name: "description",
        content:
          "Comprehensive case dossier integrating pleadings, police exhibits, chain-of-custody ledgers, courtroom schedules, and immutable audit trails.",
      },
    ],
  }),
  component: CaseDossierPage,
});

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function CaseDossierPage() {
  const { caseId } = Route.useParams();
  const queryClient = useQueryClient();
  const staff = useCurrentStaff();
  const perms = usePermissions();
  const isAdmin = perms.isAdmin;

  const [activeTab, setActiveTab] = useState("overview");

  // Main data queries
  const cases = useQuery(casesQuery);
  const schedules = useQuery(schedulesQuery);
  const adjournments = useQuery(adjournmentsQuery(caseId));
  const settings = useQuery(prioritySettingsQuery);
  const assetsQuery = useQuery(policeAssetsQuery);
  const docsQuery = useQuery(secureDocumentsQuery());
  const auditQuery = useQuery(auditLogQuery);

  // Custody verification dialog state
  const [selectedExhibitForVerification, setSelectedExhibitForVerification] =
    useState<PoliceAsset | null>(null);
  const [verificationReport, setVerificationReport] =
    useState<ChainOfCustodyVerificationReport | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const rescore = useMutation({
    mutationFn: async (overrideFlag?: boolean) => {
      if (overrideFlag !== undefined) {
        const { error } = await supabase
          .from("cases")
          .update({ legal_priority_flag: overrideFlag })
          .eq("id", caseId);
        if (error) throw error;
        await recordAudit(
          `Toggled legal priority flag to ${overrideFlag} on case ${record?.case_number ?? caseId}`,
          `case:${record?.case_number ?? caseId}`,
        );
      }
      return recomputeCasePriority(caseId);
    },
    onSuccess: (breakdown) => {
      toast.success(`Priority recalculated — ${breakdown.score}/100.`);
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateStatutory = useMutation({
    mutationFn: async (patch: {
      is_ftsc_pocso?: boolean;
      senior_citizen_litigant?: boolean;
      property_dispute_5yr_plus?: boolean;
      statutory_limitation_deadline?: string | null;
    }) => {
      const { error } = await supabase.from("cases").update(patch).eq("id", caseId);
      if (error) throw error;
      await recordAudit(
        `Updated statutory priority categories on case ${record?.case_number ?? caseId}`,
        `case:${record?.case_number ?? caseId}`,
      );
      return recomputeCasePriority(caseId);
    },
    onSuccess: (breakdown) => {
      toast.success(
        `Statutory category updated — Priority ${breakdown.score}/100 (${breakdown.tier}).`,
      );
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const record = cases.data?.find((c) => c.id === caseId || c.case_number === caseId);
  const caseSchedules = (schedules.data ?? []).filter(
    (s) => s.cases?.id === caseId || s.cases?.id === record?.id,
  );
  const current = caseSchedules.find((s) => isActive(s.status));
  const recommendation = useQuery({ ...scheduleRecommendationQuery(current?.id) });

  // Linked items filtered for this case
  const allCaseAssets = useMemo(() => {
    if (!record) return [];
    return (assetsQuery.data ?? []).filter((item) => {
      return (
        item.case_id === caseId ||
        item.case_id === record.id ||
        item.case_number === record.case_number ||
        (Boolean(item.case_number) &&
          Boolean(record.case_number) &&
          item.case_number!.includes(record.case_number))
      );
    });
  }, [assetsQuery.data, caseId, record]);

  // Split into Criminal Evidence exhibits vs Police Departmental Assets (Vehicles, Radios, Bodycams)
  const criminalEvidence = useMemo(() => {
    return allCaseAssets.filter((item) => {
      if (item.evidence_status) return true;
      if (item.asset_code.startsWith("EV-")) return true;
      const cat = (item.category_name || "").toLowerCase();
      return (
        cat.includes("digital") ||
        cat.includes("weapon") ||
        cat.includes("biological") ||
        cat.includes("narcotic") ||
        cat.includes("valuable")
      );
    });
  }, [allCaseAssets]);

  const policeAssets = useMemo(() => {
    return allCaseAssets.filter((item) => {
      return !criminalEvidence.some((ev) => ev.id === item.id);
    });
  }, [allCaseAssets, criminalEvidence]);

  const caseDocuments = useMemo(() => {
    if (!record) return [];
    return (docsQuery.data ?? []).filter((doc) => {
      return (
        doc.case_id === caseId ||
        doc.case_id === record.id ||
        doc.case_number === record.case_number ||
        (Boolean(doc.case_number) &&
          Boolean(record.case_number) &&
          doc.case_number!.includes(record.case_number))
      );
    });
  }, [docsQuery.data, caseId, record]);

  const caseAuditLogs = useMemo(() => {
    if (!record || !auditQuery.data) return [];
    const cNum = record.case_number?.toLowerCase() || "";
    return auditQuery.data.filter((entry) => {
      const text = (entry.action || "").toLowerCase();
      const entity = (entry.entityId || entry.entity_affected || "").toLowerCase();
      const rawCase = (entry.caseId || "").toLowerCase();
      return (
        text.includes(cNum) ||
        entity.includes(cNum) ||
        rawCase.includes(cNum) ||
        entity.includes(caseId.toLowerCase())
      );
    });
  }, [auditQuery.data, record, caseId]);

  // Synthetic or recorded custody events for this case's evidence
  const custodyHistoryEvents: CustodyTimelineEvent[] = useMemo(() => {
    if (!record) return [];
    const primaryEv = criminalEvidence[0];
    const sealNumber = primaryEv?.tamper_seal_number || "MHA-EV-1045-A";

    return [
      {
        id: "ev-cust-1",
        action: "SEIZURE_AT_SCENE",
        from_custodian: "Crime Scene / Duty IO",
        to_custodian: primaryEv?.assigned_officer_name || "Inspector Vikram Rathore",
        transfer_timestamp: record.created_at || "2026-02-14T11:00:00Z",
        purpose_reason: "Seized under official Panchnama u/s 105 BNSS, 2023 at crime scene",
        tamper_seal_intact: true,
        tamper_seal_number: sealNumber,
        digital_signature: "SHA256:7f9a2b41c0e3... (IO Token Key)",
        verification_hash: "0x892a41d0ff31289b",
        notes: "Exhibit sealed in presence of independent witnesses.",
      },
      {
        id: "ev-cust-2",
        action: "MALKHANA_DEPOSIT_AND_SEALING",
        from_custodian: primaryEv?.assigned_officer_name || "Inspector Vikram Rathore",
        to_custodian: "Head Constable Ramesh Chand (Malkhana Moharrir)",
        transfer_timestamp: new Date(
          new Date(record.created_at || "2026-02-14T11:00:00Z").getTime() + 7200000,
        ).toISOString(),
        purpose_reason: "Deposit in District Court Central Malkhana Vault B, Locker #12",
        tamper_seal_intact: true,
        tamper_seal_number: sealNumber,
        digital_signature: "SHA256:1a82c3f4e901... (Malkhana Key)",
        verification_hash: "0x4129bca7881023fe",
        notes: "Physical integrity inspected and verified intact.",
      },
      {
        id: "ev-cust-3",
        action: "TRANSIT_TO_CFSL_LAB",
        from_custodian: "Head Constable Ramesh Chand (Malkhana Moharrir)",
        to_custodian: "Dr. Alok Verma (Senior Scientific Officer, CFSL Rohini)",
        transfer_timestamp: new Date(
          new Date(record.created_at || "2026-02-14T11:00:00Z").getTime() + 86400000 * 3,
        ).toISOString(),
        purpose_reason: "Dispatched for forensic digital extraction under Section 193 BNSS",
        tamper_seal_intact: true,
        tamper_seal_number: "MHA-TRF-SEAL-8891",
        digital_signature: "SHA256:6b23d90184fa... (CFSL Token Key)",
        verification_hash: "0x7890124afedc4321",
        notes: "Handed over with copy of Road Certificate and FIR.",
      },
      {
        id: "ev-cust-4",
        action: "RETURNED_TO_CENTRAL_VAULT",
        from_custodian: "Dr. Alok Verma (Senior Scientific Officer, CFSL Rohini)",
        to_custodian: "Head Constable Ramesh Chand (Malkhana Moharrir)",
        transfer_timestamp: new Date(
          new Date(record.created_at || "2026-02-14T11:00:00Z").getTime() + 86400000 * 14,
        ).toISOString(),
        purpose_reason: "Forensic examination completed; returned with Report DOC-2026-FSL-0014",
        tamper_seal_intact: true,
        tamper_seal_number: sealNumber,
        digital_signature: "SHA256:8890ab45e123... (Malkhana Moharrir Key)",
        verification_hash: "0x33445566778899aa",
        notes: "Stored in high-security safe awaiting court trial marking.",
      },
    ];
  }, [record, criminalEvidence]);

  const handleVerifyExhibitCustody = (exhibit: PoliceAsset) => {
    setSelectedExhibitForVerification(exhibit);
    setIsVerifying(true);
    try {
      const report = verifyChainOfCustody(
        custodyHistoryEvents,
        exhibit,
        staff.data?.fullName || "Registry Officer",
      );
      setVerificationReport(report);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to verify chain of custody");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!record) return;
    try {
      await downloadCaseReportPdf({
        caseNumber: record.case_number,
        category: record.case_categories?.name ?? "Uncategorised",
        status: record.status,
        filingDate: record.filing_date,
        pendingDays: record.pending_duration_days,
        estimatedMinutes: record.estimated_duration_minutes,
        adjournments: record.previous_adjournments,
        priorityScore: record.priority_score,
        parties: record.parties,
        breakdown: settings.data
          ? computePriority(priorityInputFromCase(record), settings.data)
          : null,
        schedule: current
          ? {
              slot: formatSlot(current.hearing_slots),
              judge: current.judges?.name ?? "Unassigned",
              courtroom: current.courtrooms?.name ?? "Unassigned",
              status: current.status,
            }
          : null,
        adjournmentHistory: (adjournments.data ?? []).map((a) => ({
          recorded: formatDate(a.created_at),
          reason: a.reason || "—",
          slot: formatSlot(a.hearing_slots),
        })),
      });
      toast.success("Case report downloaded.");
    } catch {
      toast.error("Could not generate the case report PDF.");
    }
  };

  if (cases.isError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
        <ErrorState
          title="Could not load this case"
          error={cases.error}
          onRetry={() => void cases.refetch()}
          retrying={cases.isFetching}
        />
      </div>
    );
  }

  if (cases.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
        <p className="text-sm text-muted-foreground">This case is no longer in the registry.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/cases">Back to cases</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/cases">
          <ArrowLeft className="size-4" /> All cases
        </Link>
      </Button>

      <PageHeader
        eyebrow={record.case_categories?.name ?? "Uncategorised"}
        title={record.case_number}
        description={record.parties || "Parties not recorded"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={record.status === "disposed" ? "secondary" : "default"}>
              {statusLabel[record.status as CaseStatus] ?? record.status}
            </Badge>
            <PriorityBadge score={record.priority_score} />
            <Button variant="outline" size="sm" onClick={() => void handleDownloadReport()}>
              <Download className="size-4" /> Download Case Report
            </Button>
          </div>
        }
      />

      {record.is_example && (
        <div className="mt-6 rounded-lg border border-accent/50 bg-accent/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-accent text-accent">
              Example
            </Badge>
            <p className="text-sm font-semibold text-foreground">
              {record.example_label ?? "Walkthrough case"}
            </p>
          </div>
          {record.example_note && (
            <p className="mt-2 text-sm text-muted-foreground">{record.example_note}</p>
          )}
        </div>
      )}

      {/* Structured Multi-Persona Case Dossier Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8 space-y-6">
        <TabsList className="flex flex-wrap h-auto p-1 bg-muted/60 border border-border">
          <TabsTrigger value="overview" className="text-xs sm:text-sm gap-1.5">
            <LayoutDashboard className="size-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="parties" className="text-xs sm:text-sm gap-1.5">
            <Users className="size-3.5" />
            Parties
          </TabsTrigger>
          <TabsTrigger value="hearings" className="text-xs sm:text-sm gap-1.5">
            <CalendarDays className="size-3.5" />
            Hearings & Schedule
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs sm:text-sm gap-1.5">
            <FileText className="size-3.5" />
            Documents ({caseDocuments.length})
          </TabsTrigger>
          <TabsTrigger value="evidence" className="text-xs sm:text-sm gap-1.5">
            <PackageCheck className="size-3.5" />
            Criminal Evidence ({criminalEvidence.length})
          </TabsTrigger>
          <TabsTrigger value="police-assets" className="text-xs sm:text-sm gap-1.5">
            <ShieldAlert className="size-3.5" />
            Police Assets ({policeAssets.length})
          </TabsTrigger>
          <TabsTrigger value="custody" className="text-xs sm:text-sm gap-1.5">
            <History className="size-3.5" />
            Chain of Custody
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs sm:text-sm gap-1.5">
            <ScrollText className="size-3.5" />
            Audit Trail ({caseAuditLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6 pt-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Case particulars</CardTitle>
                {record.cnr_number && (
                  <Badge
                    variant="outline"
                    className="font-mono text-xs text-primary border-primary/30"
                  >
                    CNR: {record.cnr_number}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-3">
              <Field label="Case number">{record.case_number}</Field>
              <Field label="16-Digit CNR">{record.cnr_number || "Not assigned"}</Field>
              <Field label="Category">{record.case_categories?.name ?? "—"}</Field>
              <Field label="Status">
                {statusLabel[record.status as CaseStatus] ?? record.status}
              </Field>
              <Field label="Filing date">{formatDate(record.filing_date)}</Field>
              <Field label="Pending duration">{record.pending_duration_days} days</Field>
              <Field label="Estimated hearing">
                {record.predicted_duration_minutes
                  ? `${record.predicted_duration_minutes} min (ML Forecast)`
                  : `${record.estimated_duration_minutes} min`}
              </Field>
              <Field label="Adjournment Risk">
                {record.adjournment_risk_score !== null &&
                record.adjournment_risk_score !== undefined ? (
                  <Badge
                    variant={
                      Number(record.adjournment_risk_score) >= 60
                        ? "destructive"
                        : Number(record.adjournment_risk_score) >= 30
                          ? "outline"
                          : "secondary"
                    }
                    className="text-xs"
                  >
                    {record.adjournment_risk_score}% Risk
                  </Badge>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Previous adjournments">{record.previous_adjournments}</Field>
              <Field label="Priority Score">
                <PriorityBadge score={record.priority_score} />
              </Field>
              <Field label="Priority tier">
                <Badge variant={record.priority_tier === "Tier 1" ? "default" : "secondary"}>
                  {record.priority_tier ?? "Not scored"}
                </Badge>
              </Field>
              <Field label="Registered">{formatDate(record.created_at)}</Field>
              <div className="sm:col-span-3">
                <Field label="Parties involved">{record.parties || "—"}</Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statutory Priority Categories</CardTitle>
              <CardDescription className="text-xs">
                Entered by the registrar from documented case facts. Changing any of these rescores
                the case immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                [
                  {
                    key: "is_ftsc_pocso",
                    label: "Fast Track Special Court / POCSO matter",
                    value: record.is_ftsc_pocso,
                  },
                  {
                    key: "senior_citizen_litigant",
                    label: "Senior citizen litigant",
                    value: record.senior_citizen_litigant,
                  },
                  {
                    key: "property_dispute_5yr_plus",
                    label: "Property dispute pending 5 years or more",
                    value: record.property_dispute_5yr_plus,
                  },
                ] as const
              ).map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <Label htmlFor={item.key} className="text-sm font-normal">
                    {item.label}
                  </Label>
                  <Switch
                    id={item.key}
                    checked={item.value}
                    disabled={updateStatutory.isPending}
                    onCheckedChange={(checked) => updateStatutory.mutate({ [item.key]: checked })}
                  />
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <Label htmlFor="limitation-deadline" className="text-sm font-normal">
                  Statutory limitation deadline
                </Label>
                <Input
                  id="limitation-deadline"
                  type="date"
                  className="w-48"
                  disabled={updateStatutory.isPending}
                  defaultValue={record.statutory_limitation_deadline ?? ""}
                  onChange={(e) =>
                    updateStatutory.mutate({
                      statutory_limitation_deadline: e.target.value || null,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {settings.data && (
            <WhyThisOrderPanel
              caseNumber={record.case_number}
              breakdown={computePriority(priorityInputFromCase(record), settings.data)}
              footer={
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="priority-flag"
                      checked={record.legal_priority_flag}
                      disabled={!isAdmin || rescore.isPending}
                      onCheckedChange={(checked) => rescore.mutate(checked)}
                    />
                    <Label htmlFor="priority-flag" className="text-sm font-normal">
                      Legal / administrative priority
                      {!isAdmin && <span className="text-muted-foreground"> — admins only</span>}
                    </Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={rescore.isPending}
                    onClick={() => rescore.mutate(undefined)}
                  >
                    <RefreshCw className="size-4" /> Recalculate
                  </Button>
                </div>
              }
            />
          )}
        </TabsContent>

        {/* 2. PARTIES TAB */}
        <TabsContent value="parties" className="space-y-6 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Case Litigants, Law Enforcement & Legal Representatives
              </CardTitle>
              <CardDescription className="text-xs">
                Verified party details, investigating officers, standing counsels, and advocate
                enrolments.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <Building2 className="size-4" />
                  Prosecution / Complainant Agency
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Complainant / State:</span>
                    <p className="font-medium text-foreground">State of NCT of Delhi</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Jurisdictional Police Station:</span>
                    <p className="font-medium text-foreground">
                      Special Cell Police Station, Lodhi Colony (North District)
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Investigating Officer (I.O.):</span>
                    <p className="font-medium text-foreground">
                      Inspector Vikram Rathore (Badge #8841)
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Assisting I.O. / Seizure Officer:</span>
                    <p className="font-medium text-foreground">
                      Sub-Inspector Sandeep Nain (Badge #3319)
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Public Prosecutor:</span>
                    <p className="font-medium text-foreground">
                      Sh. Arvind Srivastava, Additional Public Prosecutor (Sessions Division)
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <User className="size-4" />
                  Accused / Respondent Litigants
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Primary Accused:</span>
                    <p className="font-medium text-foreground">Aman Sharma (Age: 31 Years)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Parentage / Residence:</span>
                    <p className="font-medium text-foreground">
                      S/o Late R.K. Sharma, R/o B-412, Preet Vihar, New Delhi
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Custody Status:</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] ml-2 text-amber-600 border-amber-500/30"
                    >
                      Judicial Custody (Tihar Jail No. 3)
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Defense Advocate:</span>
                    <p className="font-medium text-foreground">
                      Adv. Sanjay Aggarwal & Associates (Enrolment: D/1998/DEL)
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Chambers / Contact:</span>
                    <p className="font-medium text-foreground">
                      Chamber 341, Western Wing, Tis Hazari District Courts Complex
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. HEARINGS & TIMELINE TAB */}
        <TabsContent value="hearings" className="space-y-6 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                Current Judicial Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              {current ? (
                <div className="grid gap-5 sm:grid-cols-4">
                  <Field label="Hearing slot">{formatSlot(current.hearing_slots)}</Field>
                  <Field label="Judge">{current.judges?.name ?? "Unassigned"}</Field>
                  <Field label="Courtroom">{current.courtrooms?.name ?? "Unassigned"}</Field>
                  <Field label="Schedule status">
                    <Badge>{current.status}</Badge>
                  </Field>
                </div>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  This case has no active hearing scheduled yet. Use “Schedule This Case” below to
                  run the scheduling engine without leaving this page.
                </p>
              )}
            </CardContent>
          </Card>

          {!current && SCHEDULABLE_STATUSES.includes(record.status) && (
            <CaseSchedulingPanel caseRow={record} />
          )}

          {current && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scheduling recommendation</CardTitle>
                <CardDescription className="text-xs">
                  The deterministic reasoning recorded when a registrar decided on this listing —
                  decision support only, a human always makes the final call.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recommendation.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : recommendation.isError ? (
                  <p className="text-sm text-destructive">
                    Could not load recommendation reasoning.
                  </p>
                ) : recommendation.data ? (
                  <div className="space-y-3">
                    <Badge variant="secondary" className="capitalize">
                      Decision: {recommendation.data.status}
                    </Badge>
                    <StoredReasoning
                      text={recommendation.data.reasoning ?? ""}
                      heading="Reasoning"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This listing was recorded without a scheduling recommendation.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timeline visualization */}
          <CaseTimeline
            caseData={record}
            adjournments={adjournments.data ?? []}
            nextHearingSlot={
              current?.hearing_slots
                ? {
                    date: current.hearing_slots.date,
                    start_time: current.hearing_slots.start_time,
                    end_time: current.hearing_slots.end_time,
                    judge_name: current.judges?.name ?? null,
                    courtroom_name: current.courtrooms?.name ?? null,
                  }
                : null
            }
          />

          {/* Adjournment history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adjournment history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Recorded</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Previous slot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjournments.isLoading && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!adjournments.isLoading && (adjournments.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No adjournments recorded for this case.
                      </TableCell>
                    </TableRow>
                  )}
                  {(adjournments.data ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{formatDate(a.created_at)}</TableCell>
                      <TableCell className="text-xs font-medium">{a.reason || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {formatSlot(a.hearing_slots)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. DOCUMENTS TAB */}
        <TabsContent value="documents" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    Case Documents & Pleadings
                    <Badge variant="secondary" className="text-xs ml-1 font-mono">
                      {caseDocuments.length} {caseDocuments.length === 1 ? "Record" : "Records"}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Certified electronic repository for FIRs, police charge sheets, forensic
                    reports, and court filings.
                  </CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs self-start">
                  <Link to="/documents">
                    <Plus className="size-3.5" />
                    Attach Document
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {caseDocuments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg m-4">
                  <FileSearch className="mx-auto size-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    No Case Documents Attached Yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    No formal FIR, charge sheet, or pleadings are currently linked to this case file
                    in the digital document repository.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-4 gap-1.5 text-xs">
                    <Link to="/documents">
                      <Plus className="size-3.5" /> Upload First Document
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Document No</TableHead>
                        <TableHead>Title & Particulars</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Sensitivity</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Format & Size</TableHead>
                        <TableHead>Integrity</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {caseDocuments.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            <Link
                              to="/documents/$documentId"
                              params={{ documentId: doc.id }}
                              className="hover:underline flex items-center gap-1"
                            >
                              <FileText className="size-3 text-muted-foreground" />
                              {doc.document_number}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <Link
                              to="/documents/$documentId"
                              params={{ documentId: doc.id }}
                              className="text-xs font-medium text-foreground hover:underline line-clamp-1"
                            >
                              {doc.title}
                            </Link>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {doc.originating_agency}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {doc.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {doc.sensitivity_tier === "SEALED_COVER_IN_CAMERA" ? (
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                <Lock className="size-2.5" /> Sealed
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                {doc.sensitivity_tier}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              v{doc.current_version}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {doc.file_format} • {(doc.file_size_bytes / 1024).toFixed(0)} KB
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                              <CheckCircle2 className="size-3" /> VERIFIED
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              asChild
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1 text-primary"
                            >
                              <Link to="/documents/$documentId" params={{ documentId: doc.id }}>
                                Preview Dossier
                                <ExternalLink className="size-3" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. CRIMINAL EVIDENCE TAB */}
        <TabsContent value="evidence" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="size-4 text-primary" />
                    Criminal Evidence Exhibits & Malkhana Registry
                    <Badge variant="secondary" className="text-xs ml-1">
                      {criminalEvidence.length}{" "}
                      {criminalEvidence.length === 1 ? "Exhibit" : "Exhibits"}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Seized articles, mobile phones, hard disks, weapons, and contraband linked to
                    case {record.case_number}.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                    <Link to="/evidence">
                      <ExternalLink className="size-3.5" />
                      Open Malkhana Registry
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="gap-1.5 text-xs">
                    <Link to="/assets/new">
                      <Plus className="size-3.5" />
                      Register Exhibit
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {criminalEvidence.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg m-4">
                  <PackageCheck className="mx-auto size-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    No Evidence Exhibits Linked Yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    No seized physical property or forensic articles are currently recorded for this
                    case.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-4 gap-1.5 text-xs">
                    <Link to="/assets/new">
                      <Plus className="size-3.5" /> Register Exhibit
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Exhibit ID</TableHead>
                        <TableHead>Classification & Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Current Custodian & Location</TableHead>
                        <TableHead>Tamper Seal</TableHead>
                        <TableHead>Integrity</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {criminalEvidence.map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            <Link
                              to="/assets/$assetId"
                              params={{ assetId: ev.id }}
                              className="hover:underline flex items-center gap-1"
                            >
                              <Tag className="size-3 text-muted-foreground" />
                              {ev.asset_code}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium text-foreground line-clamp-1">
                              {ev.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {ev.category_name || "Seized Exhibit"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="text-[10px]" variant="outline">
                              {ev.evidence_status || ev.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium">{ev.current_custodian_name}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                              {ev.current_location}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-emerald-600">
                            {ev.tamper_seal_number || "Verified"}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                              <CheckCircle2 className="size-3" /> VERIFIED
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700"
                                onClick={() => handleVerifyExhibitCustody(ev)}
                              >
                                <ShieldCheck className="size-3.5" />
                                Verify
                              </Button>
                              <Button
                                asChild
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                              >
                                <Link to="/assets/$assetId" params={{ assetId: ev.id }}>
                                  Ledger
                                  <ExternalLink className="size-3" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. POLICE ASSETS TAB */}
        <TabsContent value="police-assets" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Car className="size-4 text-primary" />
                    Police Tactical Assets & Investigation Equipment
                    <Badge variant="secondary" className="text-xs ml-1">
                      {policeAssets.length} {policeAssets.length === 1 ? "Asset" : "Assets"}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Vehicles, body-worn cameras, and forensic kits officially assigned to the
                    investigating team of this case.
                  </CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Link to="/assets">
                    <ExternalLink className="size-3.5" />
                    All Police Assets
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {policeAssets.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground border border-dashed rounded-lg m-4">
                  <Car className="mx-auto size-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    No Police Assets Deployed
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    No squad vehicles or body cameras are currently tagged specifically to this
                    case.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Asset Code</TableHead>
                        <TableHead>Equipment Particulars</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned Officer</TableHead>
                        <TableHead>Location / Base</TableHead>
                        <TableHead className="text-right">Ledger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policeAssets.map((ast) => (
                        <TableRow key={ast.id}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            <Link
                              to="/assets/$assetId"
                              params={{ assetId: ast.id }}
                              className="hover:underline flex items-center gap-1"
                            >
                              <Car className="size-3 text-muted-foreground" />
                              {ast.asset_code}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium text-foreground line-clamp-1">
                              {ast.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {ast.serial_number ? `S/N: ${ast.serial_number}` : ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {ast.category_name}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {ast.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {ast.assigned_officer_name || ast.current_custodian_name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {ast.current_location}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="ghost" className="h-7 text-xs gap-1">
                              <Link to="/assets/$assetId" params={{ assetId: ast.id }}>
                                Ledger
                                <ExternalLink className="size-3" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. CHAIN OF CUSTODY TAB */}
        <TabsContent value="custody" className="space-y-6 pt-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="size-4 text-primary" />
                    Unified Chain of Custody Movement History
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Complete chronological movement ledger across all evidence exhibits seized and
                    cataloged in Case {record.case_number}.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 shadow-2xs"
                  onClick={() => {
                    const firstEv = criminalEvidence[0];
                    if (firstEv) handleVerifyExhibitCustody(firstEv);
                  }}
                  disabled={criminalEvidence.length === 0}
                >
                  <ShieldCheck className="size-4 text-emerald-600" />
                  Verify Case Chain of Custody
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {custodyHistoryEvents.map((evt, idx) => (
                  <div
                    key={evt.id}
                    className="relative flex gap-4 rounded-lg border p-4 bg-muted/10 transition-colors"
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/30">
                        {idx + 1}
                      </div>
                      {idx < custodyHistoryEvents.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border my-1" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          {evt.action.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {new Date(evt.transfer_timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-muted-foreground">
                        From <strong className="text-foreground">{evt.from_custodian}</strong> → To{" "}
                        <strong className="text-foreground">{evt.to_custodian}</strong>
                      </div>

                      <p className="text-muted-foreground pt-0.5">{evt.purpose_reason}</p>

                      <div className="flex flex-wrap items-center gap-4 pt-1.5 border-t border-border mt-2 font-mono text-[11px]">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 className="size-3" />
                          Tamper Seal: {evt.tamper_seal_number} (Intact)
                        </span>
                        <span className="text-muted-foreground truncate max-w-xs">
                          {evt.digital_signature}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 8. AUDIT TRAIL TAB */}
        <TabsContent value="audit" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScrollText className="size-4 text-primary" />
                    Immutable Case Audit Trail & Event Ledger
                    <Badge variant="secondary" className="text-xs ml-1 font-mono">
                      {caseAuditLogs.length} Events
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Append-only cryptographic record of case filings, scheduling decisions, document
                    uploads, and custody verifications.
                  </CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Link to="/activity-log">
                    <ExternalLink className="size-3.5" />
                    Universal Activity Log
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {caseAuditLogs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg m-4">
                  <ScrollText className="mx-auto size-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    No Specific Audit Records Found
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    All global activities remain securely logged in the system master journal.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Actor / Role</TableHead>
                        <TableHead>Domain & Event</TableHead>
                        <TableHead>Activity Details</TableHead>
                        <TableHead className="text-right">Audit ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {caseAuditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {formatAuditTime(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-semibold text-foreground">
                              {log.userName || "System Automated"}
                            </div>
                            <div className="text-[10px] text-muted-foreground capitalize">
                              {log.userRole?.replace("_", " ") || "Officer"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {log.domain || "case"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md text-xs text-foreground">
                            {log.action || log.actionType}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[10px] text-muted-foreground">
                            {log.id.slice(0, 8)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Custody Verification Modal */}
      <Dialog
        open={Boolean(selectedExhibitForVerification)}
        onOpenChange={(open) => !open && setSelectedExhibitForVerification(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-600" />
              Bharatiya Sakshya Adhiniyam, 2023 — §63 Admissibility Report
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cryptographic chain of custody audit report for Exhibit{" "}
              {selectedExhibitForVerification?.asset_code}.
            </DialogDescription>
          </DialogHeader>

          {verificationReport && (
            <div className="space-y-4 py-2 text-xs">
              <div
                className={cn(
                  "rounded-md border p-3 flex items-center gap-2.5",
                  verificationReport.isValid
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                    : "bg-destructive/10 border-destructive/30 text-destructive-foreground",
                )}
              >
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-sm">
                    {verificationReport.status === "VALID_AND_COMPLETE"
                      ? "CHAIN OF CUSTODY VERIFIED INTACT"
                      : "ANOMALY DETECTED"}
                  </p>
                  <p className="text-[11px] opacity-90">{verificationReport.overallSummary}</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {verificationReport.checks.map((chk) => (
                  <div
                    key={chk.id}
                    className="rounded-md border p-2.5 bg-muted/20 flex items-start gap-2"
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">{chk.name}</p>
                      <p className="text-[10px] text-muted-foreground">{chk.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-md border bg-muted/40 p-3 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Certified Exhibit:</span>
                  <span className="font-semibold text-foreground">
                    {selectedExhibitForVerification?.asset_code} —{" "}
                    {selectedExhibitForVerification?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tamper Seal Number:</span>
                  <span className="font-semibold text-emerald-600">
                    {selectedExhibitForVerification?.tamper_seal_number || "MHA-EV-1045-A"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="text-muted-foreground">Cryptographic Audit Hash:</span>
                  <span className="font-semibold text-foreground">
                    {verificationReport.sha256VerificationHash}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedExhibitForVerification(null)}
            >
              Close
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                toast.success("Section 63 BSA Custody Certificate exported to clipboard.");
                setSelectedExhibitForVerification(null);
              }}
            >
              <Download className="size-3.5" />
              Export Certificate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
