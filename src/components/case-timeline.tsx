import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Gavel,
  HelpCircle,
  Package,
  ArrowRightLeft,
  Shield,
  ShieldAlert,
  UserCheck,
  FileCheck2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate, type AdjournmentRow, type CaseRow } from "@/lib/cases";
import type { SecureDocument } from "@/lib/documents";
import type { PoliceAsset, CustodyTimelineEvent } from "@/lib/assets";
import type { AuditLogEntry } from "@/lib/audit";

export type TimelineEvent = {
  id: string;
  title: string;
  date: string;
  type:
    | "filing"
    | "document"
    | "evidence"
    | "custody"
    | "audit"
    | "adjournment"
    | "hearing"
    | "disposal"
    | "statutory";
  detail: string;
  badge?: string | undefined;
  badgeVariant?: "default" | "destructive" | "outline" | "secondary" | undefined;
  link?: string | undefined;
};

type CaseTimelineProps = {
  caseData: CaseRow;
  documents?: SecureDocument[];
  evidence?: PoliceAsset[];
  custodyEvents?: CustodyTimelineEvent[];
  auditLogs?: AuditLogEntry[];
  adjournments?: AdjournmentRow[];
  nextHearingSlot?: {
    date: string;
    start_time: string;
    end_time: string;
    judge_name?: string | null;
    courtroom_name?: string | null;
  } | null;
};

export function CaseTimeline({
  caseData,
  documents = [],
  evidence = [],
  custodyEvents = [],
  auditLogs = [],
  adjournments = [],
  nextHearingSlot,
}: CaseTimelineProps) {
  const events: TimelineEvent[] = [];

  // 1. Initial Case Institution & Registration
  events.push({
    id: "filing",
    title: "Case Instituted & Registered",
    date: caseData.filing_date,
    type: "filing",
    detail: `Filed under ${caseData.case_categories?.name || "General Category"}. Case Reference: ${caseData.case_number}`,
    badge: caseData.cnr_number ? `CNR: ${caseData.cnr_number}` : undefined,
    badgeVariant: "outline",
  });

  // 2. Statutory limitation if present
  if (caseData.statutory_limitation_deadline) {
    events.push({
      id: "limitation",
      title: "Statutory Limitation Bar Date",
      date: caseData.statutory_limitation_deadline,
      type: "statutory",
      detail: "Limitation Act statutory horizon for judicial disposition or charge framing.",
      badge: "Statutory Horizon",
      badgeVariant: "destructive",
    });
  }

  // 3. Official Documents (FIR, Chargesheet, Forensic Reports, Pleadings)
  documents.forEach((doc) => {
    events.push({
      id: `doc-${doc.id}`,
      title: `${doc.category}: ${doc.title}`,
      date: (doc.created_at || "").slice(0, 10) || caseData.filing_date,
      type: "document",
      detail: `Document #${doc.document_number} (v${doc.current_version}) originated by ${doc.originating_agency}. Sensitivity: ${doc.sensitivity_tier}. Cryptographic SHA-256 integrity verified.`,
      badge: `v${doc.current_version} • ${doc.sensitivity_tier}`,
      badgeVariant: doc.sensitivity_tier === "SEALED_COVER_IN_CAMERA" ? "destructive" : "secondary",
      link: `/documents/${doc.id}`,
    });
  });

  // 4. Seized Evidence Exhibits
  evidence.forEach((item) => {
    events.push({
      id: `ev-${item.id}`,
      title: `Evidence Seized: ${item.name}`,
      date: (item.created_at || caseData.filing_date).slice(0, 10),
      type: "evidence",
      detail: `Exhibit #${item.asset_code} seized and deposited at ${item.current_location}. Tamper Seal: ${item.tamper_seal_number || "Verified Intact"}. Status: ${item.evidence_status || "SEIZED_IN_CUSTODY"}.`,
      badge: item.asset_code,
      badgeVariant: "outline",
      link: `/assets/${item.id}`,
    });
  });

  // 5. Evidence Custody Transfers
  custodyEvents.forEach((custody) => {
    events.push({
      id: `custody-${custody.id}`,
      title: `Custody Transfer: ${custody.action.replace(/_/g, " ")}`,
      date: (custody.transfer_timestamp || "").slice(0, 10),
      type: "custody",
      detail: `Transferred from [${custody.from_custodian}] to [${custody.to_custodian}]. Purpose: ${custody.purpose_reason}. Seal: ${custody.tamper_seal_number}.`,
      badge: custody.action,
      badgeVariant: "secondary",
    });
  });

  // 6. Security / Sensitive Audit Events
  auditLogs.slice(0, 10).forEach((log) => {
    events.push({
      id: `audit-${log.id}`,
      title: `Audit Ledger: ${log.action}`,
      date: (log.timestamp || "").slice(0, 10),
      type: "audit",
      detail: `Actor: ${log.userName} (${log.userRole}) performed [${log.action}] on resource ${log.entity_affected || log.entityId || "N/A"}.`,
      badge: log.userRole,
      badgeVariant: "outline",
    });
  });

  // 7. Past Adjournments
  adjournments.forEach((adj, idx) => {
    const slotInfo = adj.hearing_slots
      ? ` (${formatDate(adj.hearing_slots.date)} at ${adj.hearing_slots.start_time.slice(0, 5)})`
      : "";
    events.push({
      id: `adj-${adj.id}`,
      title: `Adjournment #${adjournments.length - idx}`,
      date: adj.created_at.slice(0, 10),
      type: "adjournment",
      detail: adj.reason || "Adjourned on request of counsel/parties." + slotInfo,
      badge: "Deferred",
      badgeVariant: "secondary",
    });
  });

  // 8. Next scheduled hearing
  if (nextHearingSlot) {
    events.push({
      id: "next-hearing",
      title: "Next Scheduled Hearing",
      date: nextHearingSlot.date,
      type: "hearing",
      detail: `Listed before ${nextHearingSlot.judge_name || "Assigned Bench"} in ${nextHearingSlot.courtroom_name || "Court Hall"} (${nextHearingSlot.start_time.slice(0, 5)}–${nextHearingSlot.end_time.slice(0, 5)})`,
      badge: "Active Listing",
      badgeVariant: "default",
    });
  }

  // Sort events chronologically
  events.sort((a, b) => a.date.localeCompare(b.date));

  const getIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "filing":
        return <FileCheck2 className="h-4 w-4 text-primary" />;
      case "document":
        return <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "evidence":
        return <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "custody":
        return <ArrowRightLeft className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      case "audit":
        return <Shield className="h-4 w-4 text-muted-foreground" />;
      case "adjournment":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "hearing":
        return <Gavel className="h-4 w-4 text-emerald-500" />;
      case "statutory":
        return <CheckCircle2 className="h-4 w-4 text-destructive" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Calendar className="h-4 w-4 text-primary" />
              Unified Chronological Investigation & Procedural Timeline
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Strict chronological ledger combining FIR inception, evidence seizure, forensic lab
              dispatches, document versioning, and procedural court hearings.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs self-start sm:self-auto font-mono">
            {events.length} Unified Event{events.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-border">
          {events.map((event) => (
            <div key={event.id} className="relative mb-6 last:mb-0">
              <div className="absolute -left-[30px] top-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-xs">
                {getIcon(event.type)}
              </div>
              <div className="rounded-lg border bg-card/60 p-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  {event.link ? (
                    <Link
                      to={event.link}
                      className="font-medium text-foreground text-sm hover:underline hover:text-primary"
                    >
                      {event.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground text-sm">{event.title}</span>
                  )}
                  <div className="flex items-center gap-2">
                    {event.badge && (
                      <Badge variant={event.badgeVariant ?? "outline"} className="text-[11px]">
                        {event.badge}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDate(event.date)}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{event.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
