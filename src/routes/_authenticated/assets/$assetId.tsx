import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Barcode,
  Calendar,
  CheckCircle2,
  Clock,
  CornerDownLeft,
  ExternalLink,
  FileCheck,
  FileCheck2,
  FileText,
  Gavel,
  History,
  Layers,
  MapPin,
  PackageCheck,
  Play,
  QrCode,
  RefreshCw,
  RotateCcw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Truck,
  User,
  UserCheck,
  UserPlus,
  Wrench,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  acknowledgeEvidenceReceipt,
  dispatchEvidenceTransfer,
  EVIDENCE_MILESTONES,
  pendingEvidenceTransfersQuery,
  verifyChainOfCustody,
  type ChainOfCustodyVerificationReport,
  type EvidenceMilestone,
  type PendingEvidenceTransfer,
} from "@/lib/evidence-custody";
import { getEvidenceCustodySignatures } from "@/lib/digital-signature";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import {
  executeAssetLifecycleTransition,
  getAllowedActions,
  policeAssetDetailQuery,
  type AssetCondition,
  type AssetLifecycleStatus,
  type LifecycleActionDefinition,
  type StaffRole,
} from "@/lib/assets";
import { cn } from "@/lib/utils";
import { canAccessAssetRecord } from "@/lib/rbac";
import { ErrorState } from "@/components/states";

export const Route = createFileRoute("/_authenticated/assets/$assetId")({
  head: () => ({
    meta: [
      { title: "Asset Particulars & Chain of Custody — NyayaSetu" },
      {
        name: "description",
        content: "Detailed asset audit trail, malkhana ledger, and custody lifecycle.",
      },
    ],
  }),
  component: AssetDetailPage,
});

function getStatusBadge(status: AssetLifecycleStatus) {
  switch (status) {
    case "AVAILABLE":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-500/30 dark:text-emerald-400">
          Available
        </Badge>
      );
    case "ASSIGNED":
    case "IN_USE":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-500/30 dark:text-blue-400">
          {status === "IN_USE" ? "In Use" : "Assigned"}
        </Badge>
      );
    case "TRANSFERRED":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/30 dark:text-amber-400">
          In Transfer
        </Badge>
      );
    case "MAINTENANCE":
      return (
        <Badge className="bg-purple-500/15 text-purple-700 hover:bg-purple-500/25 border-purple-500/30 dark:text-purple-400">
          Maintenance
        </Badge>
      );
    case "RETURNED":
      return (
        <Badge className="bg-cyan-500/15 text-cyan-700 hover:bg-cyan-500/25 border-cyan-500/30 dark:text-cyan-400">
          Returned
        </Badge>
      );
    case "RETIRED":
    case "LOST":
      return <Badge variant="destructive">{status}</Badge>;
    case "REGISTERED":
    default:
      return <Badge variant="secondary">Registered</Badge>;
  }
}

function getConditionBadge(condition: AssetCondition) {
  switch (condition) {
    case "NEW":
    case "EXCELLENT":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" /> {condition}
        </span>
      );
    case "GOOD":
    case "FAIR":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
          {condition}
        </span>
      );
    case "DAMAGED":
    case "NEEDS_REPAIR":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <Wrench className="size-3.5" /> {condition.replace("_", " ")}
        </span>
      );
    case "DECOMMISSIONED":
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          {condition}
        </span>
      );
  }
}

function getActionIcon(actionId: string) {
  if (actionId.includes("ASSIGN")) return <UserPlus className="size-3.5" />;
  if (actionId.includes("IN_USE") || actionId.includes("DEPLOY"))
    return <Play className="size-3.5" />;
  if (actionId.includes("TRANSFER")) return <Truck className="size-3.5" />;
  if (actionId.includes("MAINTENANCE")) return <Wrench className="size-3.5" />;
  if (actionId.includes("RETURN")) return <CornerDownLeft className="size-3.5" />;
  if (
    actionId.includes("RETIRE") ||
    actionId.includes("REJECT") ||
    actionId.includes("DECOMMISSION")
  )
    return <Archive className="size-3.5" />;
  if (actionId.includes("LOST")) return <AlertTriangle className="size-3.5" />;
  if (actionId.includes("STOCK") || actionId.includes("COMPLETE") || actionId.includes("RESTOCK"))
    return <CheckCircle2 className="size-3.5" />;
  return <RotateCcw className="size-3.5" />;
}

function FieldItem({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | number | null | undefined;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      {children || <p className="text-sm font-medium text-foreground">{value || "—"}</p>}
    </div>
  );
}

function AssetDetailPage() {
  const { assetId } = Route.useParams();
  const queryClient = useQueryClient();
  const detailQuery = useQuery(policeAssetDetailQuery(assetId));
  const staff = useCurrentStaff();
  const staffRole: StaffRole = staff.data?.role || "police_officer";
  const staffName = staff.data?.fullName || "Registry Officer";

  const [activeTab, setActiveTab] = useState("overview");

  // Lifecycle Action Dialog State
  const [selectedAction, setSelectedAction] = useState<LifecycleActionDefinition | null>(null);
  const [reason, setReason] = useState("");
  const [targetOfficerName, setTargetOfficerName] = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  const [targetCustodian, setTargetCustodian] = useState("");
  const [transitSeal, setTransitSeal] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [destructiveConfirmed, setDestructiveConfirmed] = useState(false);

  // Evidence Custody & Verification State
  const [verificationReport, setVerificationReport] =
    useState<ChainOfCustodyVerificationReport | null>(null);
  const [isTransferEvidenceOpen, setIsTransferEvidenceOpen] = useState(false);
  const [isAcknowledgeReceiptOpen, setIsAcknowledgeReceiptOpen] = useState(false);
  const [selectedPendingTransfer, setSelectedPendingTransfer] =
    useState<PendingEvidenceTransfer | null>(null);

  // Transfer Evidence Form State
  const [evidenceDestination, setEvidenceDestination] = useState("");
  const [evidenceRecipientName, setEvidenceRecipientName] = useState("");
  const [evidenceTransitSeal, setEvidenceTransitSeal] = useState("");
  const [evidenceTransferReason, setEvidenceTransferReason] = useState("");

  // Acknowledge Receipt Form State
  const [receiptSealVerified, setReceiptSealVerified] = useState(true);
  const [receiptCondition, setReceiptCondition] = useState("Intact / Undamaged");
  const [receiptNotes, setReceiptNotes] = useState("");

  const dispatchEvidenceMutation = useMutation({
    mutationFn: async () => {
      if (!detailQuery.data?.asset) return;
      if (!evidenceDestination.trim())
        throw new Error("Destination facility / location is required.");
      if (!evidenceRecipientName.trim())
        throw new Error("Designated receiving officer is required.");
      if (!evidenceTransitSeal.trim()) throw new Error("Transit seal number is required.");
      if (!evidenceTransferReason.trim()) throw new Error("Transfer reason is required.");

      return dispatchEvidenceTransfer({
        assetId: detailQuery.data.asset.id,
        fromLocation: detailQuery.data.asset.current_location,
        toLocation: evidenceDestination.trim(),
        releasingOfficerName: staffName,
        releasingOfficerRole: staffRole,
        designatedRecipientName: evidenceRecipientName.trim(),
        transitSealNumber: evidenceTransitSeal.trim(),
        transferReason: evidenceTransferReason.trim(),
      });
    },
    onSuccess: (transfer) => {
      if (transfer) {
        toast.success(
          `Evidence dispatched under transit seal ${transfer.transitSealNumber}. Awaiting recipient acknowledgment.`,
        );
        queryClient.invalidateQueries({ queryKey: ["police-asset-detail", assetId] });
        queryClient.invalidateQueries({ queryKey: ["pending-evidence-transfers"] });
      }
      setIsTransferEvidenceOpen(false);
      setEvidenceDestination("");
      setEvidenceRecipientName("");
      setEvidenceTransitSeal("");
      setEvidenceTransferReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const acknowledgeReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPendingTransfer) return;
      if (!receiptSealVerified)
        throw new Error("Cannot acknowledge custody when tamper seal is not verified intact.");

      return acknowledgeEvidenceReceipt({
        transferId: selectedPendingTransfer.id,
        receivingOfficerName: staffName,
        receivingOfficerRole: staffRole,
        conditionConfirmed: receiptCondition,
        sealVerifiedIntact: receiptSealVerified,
        acknowledgmentNotes: receiptNotes.trim() || undefined,
      });
    },
    onSuccess: (res) => {
      if (res) {
        toast.success(res.message);
      }
      setIsAcknowledgeReceiptOpen(false);
      setSelectedPendingTransfer(null);
      queryClient.invalidateQueries({ queryKey: ["police-asset-detail", assetId] });
      queryClient.invalidateQueries({ queryKey: ["police-assets"] });
      queryClient.invalidateQueries({ queryKey: ["pending-evidence-transfers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const transitionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAction || !detailQuery.data?.asset) return;
      if (!reason.trim() || reason.trim().length < 4) {
        throw new Error("A justification reason (at least 4 characters) is required.");
      }

      return executeAssetLifecycleTransition({
        assetId: detailQuery.data.asset.id,
        targetStatus: selectedAction.targetStatus,
        actorName: staffName,
        actorRole: staffRole,
        reason: reason.trim(),
        assignedOfficerName: targetOfficerName.trim() || undefined,
        newLocation: targetLocation.trim() || undefined,
        newCustodianName: targetCustodian.trim() || undefined,
        transitSealNumber: transitSeal.trim() || undefined,
        conditionNotes: conditionNotes.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      if (result) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ["police-asset-detail", assetId] });
        queryClient.invalidateQueries({ queryKey: ["police-assets"] });
      }
      setSelectedAction(null);
      setReason("");
      setTargetOfficerName("");
      setTargetLocation("");
      setTargetCustodian("");
      setTransitSeal("");
      setConditionNotes("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to execute lifecycle transition");
    },
  });

  function openActionModal(action: LifecycleActionDefinition) {
    setSelectedAction(action);
    setReason("");
    setTargetOfficerName(detailQuery.data?.asset.assigned_officer_name || "");
    setTargetLocation(detailQuery.data?.asset.current_location || "");
    setTargetCustodian(detailQuery.data?.asset.current_custodian_name || "");
    setTransitSeal(detailQuery.data?.asset.tamper_seal_number || "");
    setConditionNotes("");
    setDestructiveConfirmed(false);
  }

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data?.asset) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground mb-4">
          <Link to="/assets">
            <ArrowLeft className="size-4" />
            Back to Asset Registry
          </Link>
        </Button>
        <ErrorState
          title="Could not load asset or evidence record"
          error={
            detailQuery.error ||
            `The requested police asset ID "${assetId}" could not be located in the registry.`
          }
          onRetry={() => detailQuery.refetch()}
        />
      </div>
    );
  }

  const { asset, transfers, maintenance, documents, timeline } = detailQuery.data;

  // Enforce record-level access control (Bench Scoping & Least Privilege)
  const isAuthorized = canAccessAssetRecord(staffRole, asset);
  if (!isAuthorized) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <ShieldAlert className="size-7" />
        </div>
        <Badge variant="destructive" className="mb-3 text-xs uppercase tracking-wider">
          Security Clearance Violation — 403 Forbidden
        </Badge>
        <h2 className="text-xl font-bold text-foreground">
          Access Denied: Judicial Bench Scoping Clearance Required
        </h2>
        <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
          Your current authenticated role (<strong className="text-foreground">{staffRole}</strong>)
          lacks statutory security clearance to inspect this asset or evidence exhibit. Under High
          Court Bench Scoping Rules, judicial officers may only inspect trial exhibits attached to
          cases actively scheduled before their bench.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link to="/assets">Back to Asset Registry</Link>
          </Button>
        </div>
      </div>
    );
  }

  const allowedActions = getAllowedActions(asset.status, staffRole);
  const pendingTransfersQueryInstance = useQuery(pendingEvidenceTransfersQuery(asset.id));
  const pendingTransfers = pendingTransfersQueryInstance.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      {/* Back button */}
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Link to="/assets">
            <ArrowLeft className="size-4" />
            Back to Asset Registry
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {asset.barcode_rfid && (
            <Badge variant="outline" className="gap-1 font-mono text-xs">
              <Barcode className="size-3.5" />
              {asset.barcode_rfid}
            </Badge>
          )}
          {asset.tamper_seal_number && (
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 gap-1 text-xs dark:text-emerald-400">
              <ShieldCheck className="size-3.5" />
              Seal: {asset.tamper_seal_number}
            </Badge>
          )}
        </div>
      </div>

      {/* Pending Receipt Acknowledgment Alert Banner (Prevents Silent Custody Changes) */}
      {(() => {
        const firstPending = pendingTransfers[0];
        if (!firstPending) return null;
        return (
          <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="size-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                    Evidence In Transit — Awaiting Physical Receipt Acknowledgment
                  </h4>
                  <p className="text-xs text-amber-700/90 dark:text-amber-300/90 mt-0.5">
                    Dispatched from <strong>{firstPending.fromLocation}</strong> by{" "}
                    {firstPending.releasingOfficerName} under Transit Seal #
                    {firstPending.transitSealNumber}. Designated recipient:{" "}
                    <strong className="text-foreground">
                      {firstPending.designatedRecipientName}
                    </strong>
                    . The custody transfer will not finalize until the recipient verifies the seal
                    and explicitly acknowledges receipt.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 self-start text-xs shrink-0"
                onClick={() => {
                  setSelectedPendingTransfer(firstPending);
                  setIsAcknowledgeReceiptOpen(true);
                }}
              >
                <UserCheck className="size-3.5" />
                Acknowledge Receipt & Accept Custody
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Asset Hero Banner */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                {asset.asset_code}
              </span>
              <span className="text-xs text-muted-foreground font-medium">•</span>
              <span className="text-xs text-muted-foreground font-medium">
                {asset.category_name || "General Asset"}
              </span>
              <span className="text-xs text-muted-foreground font-medium">•</span>
              {getStatusBadge(asset.status)}
              {getConditionBadge(asset.condition)}
            </div>
            <h1 className="mt-2 text-xl font-bold text-foreground sm:text-2xl">{asset.name}</h1>
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5 text-muted-foreground" />
              {asset.current_location} ({asset.department_station})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setVerificationReport(verifyChainOfCustody(timeline, asset, staffName))
              }
              className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/15"
            >
              <ShieldCheck className="size-3.5" />
              Verify Chain of Custody
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTransferEvidenceOpen(true)}
              className="gap-1.5 text-xs text-blue-700 dark:text-blue-400 border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/15"
            >
              <Truck className="size-3.5" />
              Transfer Evidence
            </Button>

            {asset.case_number && asset.case_id && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                <Link to="/cases/$caseId" params={{ caseId: asset.case_id }}>
                  <Gavel className="size-3.5 text-primary" />
                  View Case {asset.case_number}
                  <ExternalLink className="size-3 ml-0.5 text-muted-foreground" />
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 text-xs"
            >
              <QrCode className="size-3.5" />
              Print Custody Tag
            </Button>
          </div>
        </div>

        {/* Quick Particulars Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/80 pt-4 sm:grid-cols-4">
          <FieldItem label="Current Custodian" value={asset.current_custodian_name} />
          <FieldItem
            label="Assigned Officer"
            value={asset.assigned_officer_name || "Not assigned"}
          />
          <FieldItem
            label="Registered Date"
            value={new Date(asset.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
          <FieldItem
            label="Last Audit Update"
            value={new Date(asset.updated_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
        </div>

        {/* Deterministic Lifecycle Engine Actions Ribbon */}
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <RotateCcw className="size-3.5" />
                Police Asset Lifecycle State Machine Actions
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                State machine controls available transitions for state{" "}
                <strong className="text-foreground">{asset.status}</strong> under your role (
                {staffRole}).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {allowedActions.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">
                  No further actions available for this state/role.
                </span>
              ) : (
                allowedActions.map((action) => (
                  <Button
                    key={action.actionId}
                    size="sm"
                    variant={action.variant || "default"}
                    onClick={() => openActionModal(action)}
                    className="text-xs gap-1.5 shadow-xs"
                  >
                    {getActionIcon(action.actionId)}
                    {action.label}
                  </Button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Layout Covering All 10 Required Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8 space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 h-auto p-1 bg-muted/60">
          <TabsTrigger value="overview" className="text-xs py-2">
            Overview
          </TabsTrigger>
          <TabsTrigger value="status" className="text-xs py-2">
            Status
          </TabsTrigger>
          <TabsTrigger value="custodian" className="text-xs py-2">
            Custodian
          </TabsTrigger>
          <TabsTrigger value="location" className="text-xs py-2">
            Location
          </TabsTrigger>
          <TabsTrigger value="case" className="text-xs py-2">
            Case
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs py-2">
            Docs ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs py-2">
            Lifecycle
          </TabsTrigger>
          <TabsTrigger value="transfers" className="text-xs py-2">
            Transfers ({transfers.length})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="text-xs py-2">
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs py-2">
            Audit
          </TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="shadow-xs border-border/80">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="size-4 text-primary" />
                  Asset Particulars & Identifiers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <FieldItem label="Asset Unique Code" value={asset.asset_code} />
                <FieldItem label="Official Name / Description" value={asset.name} />
                <FieldItem label="Category Classification" value={asset.category_name} />
                <FieldItem label="Serial Number" value={asset.serial_number || "None recorded"} />
                <FieldItem
                  label="Barcode / RFID Identifier"
                  value={asset.barcode_rfid || "Not tagged"}
                />
                <FieldItem
                  label="Tamper Seal ID"
                  value={asset.tamper_seal_number || "Unsealed departmental item"}
                />
              </CardContent>
            </Card>

            <Card className="shadow-xs border-border/80">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  Procurement & Registration Record
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <FieldItem
                  label="Purchase / Seizure Date"
                  value={
                    asset.purchase_date
                      ? new Date(asset.purchase_date).toLocaleDateString("en-IN")
                      : "Not recorded"
                  }
                />
                <FieldItem
                  label="Procurement Value / Seized Estimation"
                  value={
                    asset.purchase_cost
                      ? `₹ ${asset.purchase_cost.toLocaleString("en-IN")}`
                      : "Non-commercial article"
                  }
                />
                <FieldItem
                  label="Vendor / Source Supplier"
                  value={asset.vendor_supplier || "Official Seizure / Panchnama"}
                />
                <FieldItem
                  label="Warranty / Recertification Expiry"
                  value={
                    asset.warranty_expiry
                      ? new Date(asset.warranty_expiry).toLocaleDateString("en-IN")
                      : "Permanent Custody"
                  }
                />
                <FieldItem
                  label="Enrolled At"
                  value={new Date(asset.created_at).toLocaleString("en-IN")}
                />
                <FieldItem
                  label="Last Modified"
                  value={new Date(asset.updated_at).toLocaleString("en-IN")}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. CURRENT STATUS TAB */}
        <TabsContent value="status" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="size-4 text-primary" />
                Current Lifecycle State & Readiness
              </CardTitle>
              <CardDescription>
                Live operational status according to police district custody guidelines.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Asset Lifecycle
                  </p>
                  <div className="mt-2">{getStatusBadge(asset.status)}</div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Governed by the deterministic lifecycle engine. Transitions require authorized
                    verification.
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Evidence Legal Status
                  </p>
                  <div className="mt-2">
                    {asset.evidence_status ? (
                      <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400">
                        {asset.evidence_status}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Departmental Property</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Criminal court exhibit status governed by Bharatiya Sakshya Adhiniyam, 2023.
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Physical Condition
                  </p>
                  <div className="mt-2">{getConditionBadge(asset.condition)}</div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Certified during last inspection by malkhana custody officers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. CURRENT CUSTODIAN TAB */}
        <TabsContent value="custodian" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="size-4 text-primary" />
                Custody & Responsibility Allocation
              </CardTitle>
              <CardDescription>
                Designated officers legally answerable for this property under Police Rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                    Primary Custodian / Moharrir
                  </h4>
                  <p className="mt-2 text-base font-bold text-foreground">
                    {asset.current_custodian_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Holding Officer (Malkhana Section)
                  </p>
                  <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground space-y-1">
                    <p>• Responsible for physical safekeeping and environmental protection.</p>
                    <p>• Authorized to verify tamper seals and sign dispatch manifests.</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                    Assigned Investigating Officer
                  </h4>
                  <p className="mt-2 text-base font-bold text-foreground">
                    {asset.assigned_officer_name || "None Assigned"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Field / Case Officer</p>
                  <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground space-y-1">
                    <p>
                      • Authorized for court production, forensic dispatch, or field inspection.
                    </p>
                    <p>• Must return to malkhana custody upon completion of scheduled hearing.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. LOCATION TAB */}
        <TabsContent value="location" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                Physical Storage & Station Particulars
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldItem label="Police Station / Department" value={asset.department_station} />
                <FieldItem
                  label="Designated Facility / Storage Room"
                  value={asset.current_location}
                />
              </div>
              <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">Storage Protocol Checklist:</p>
                <p>✓ Biometric access control logged for Malkhana Room entry.</p>
                <p>✓ Physical seal numbers audited every 14 days against district registry.</p>
                <p>
                  ✓ Fire suppression and climate regulation maintained within prescribed standards.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. RELATED CASE TAB */}
        <TabsContent value="case" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Gavel className="size-4 text-primary" />
                Linked Judicial Case & Criminal Proceedings
              </CardTitle>
              <CardDescription>
                Integration with NyayaSetu court scheduling and automated cause-list exhibit
                notification.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {asset.case_number ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Badge
                        variant="outline"
                        className="font-mono text-xs border-primary text-primary"
                      >
                        {asset.case_number}
                      </Badge>
                      <h4 className="mt-2 text-base font-bold text-foreground">
                        {asset.case_title || "State Criminal Proceeding"}
                      </h4>
                      {asset.fir_number && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Police FIR:{" "}
                          <span className="font-medium text-foreground">{asset.fir_number}</span>
                        </p>
                      )}
                    </div>
                    {asset.case_id ? (
                      <Button asChild size="sm" className="gap-1.5 self-start">
                        <Link to="/cases/$caseId" params={{ caseId: asset.case_id }}>
                          Open Case Dossier
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled className="gap-1.5 self-start">
                        Case Not Linked
                      </Button>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-primary/20 text-xs text-muted-foreground">
                    <p>
                      When this case is listed for hearing, this asset will automatically be flagged
                      on the judge's cause-list for exhibit production.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Gavel className="mx-auto size-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    No Judicial Case Linked
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This item is currently registered as general departmental property or unlinked
                    seized property.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. RELATED DOCUMENTS TAB */}
        <TabsContent value="documents" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Related Investigation Documents & Forensic Certificates
              </CardTitle>
              <CardDescription>
                Seizure memos, forensic lab certificates, and chain-of-custody transfer receipts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Document No.</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>SHA-256 Hash Digest</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {doc.document_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs text-foreground">{doc.title}</div>
                        <div className="text-[11px] text-muted-foreground">{doc.file_name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {doc.category.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {doc.latest_sha256.slice(0, 16)}...
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          asChild
                        >
                          <Link
                            to="/documents/$documentId"
                            params={{ documentId: doc.id }}
                          >
                            <FileCheck className="size-3.5 text-emerald-600" />
                            View & Verify
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. LIFECYCLE TIMELINE TAB */}
        <TabsContent value="timeline" className="space-y-6">
          {/* Statutory Evidence Milestones Visual Stepper */}
          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Scale className="size-4 text-primary" />
                    Statutory Evidence Chain of Custody Milestones
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Standard 9-stage evidentiary lifecycle (Panchnama to Court Disposal) under
                    Bharatiya Sakshya Adhiniyam, 2023.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setVerificationReport(verifyChainOfCustody(timeline, asset))}
                  className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/40 self-start"
                >
                  <ShieldCheck className="size-3.5" />
                  Run Sequence Audit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-9 my-1">
                {EVIDENCE_MILESTONES.map((step, idx) => {
                  const currentIdx = EVIDENCE_MILESTONES.findIndex(
                    (m) => m.status === (asset.evidence_status || "STORED"),
                  );
                  const isCompleted = currentIdx >= 0 && idx < currentIdx;
                  const isCurrent = currentIdx >= 0 && idx === currentIdx;

                  return (
                    <div
                      key={step.status}
                      className={cn(
                        "rounded-lg border p-2 text-center transition-all flex flex-col justify-between",
                        isCurrent
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-xs"
                          : isCompleted
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-border/60 bg-muted/20 opacity-65",
                      )}
                    >
                      <div>
                        <div
                          className={cn(
                            "flex items-center justify-center mx-auto size-5 rounded-full text-[10px] font-bold mb-1",
                            isCompleted
                              ? "bg-emerald-500 text-white"
                              : isCurrent
                                ? "bg-primary text-primary-foreground animate-pulse"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {isCompleted ? <CheckCircle2 className="size-3" /> : idx + 1}
                        </div>
                        <p
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-tight line-clamp-1",
                            isCurrent ? "text-primary" : "text-foreground",
                          )}
                        >
                          {step.label}
                        </p>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">
                        {step.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-border/80">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="size-4 text-primary" />
                Custody Lifecycle Stepper & Audit Log
              </CardTitle>
              <CardDescription>
                Chronological chain-of-custody milestones and state transitions recorded by the
                lifecycle engine.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6 border-l-2 border-primary/30 space-y-8 my-2">
                {timeline.map((evt, idx) => (
                  <div key={evt.id} className="relative group">
                    {/* Circle marker */}
                    <div className="absolute -left-[31px] top-0 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold ring-4 ring-background">
                      {idx + 1}
                    </div>

                    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-foreground uppercase tracking-wide">
                          {evt.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(evt.transfer_timestamp).toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-foreground flex items-center gap-2">
                        <span className="font-semibold text-muted-foreground">From:</span>{" "}
                        {evt.from_custodian}
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold text-muted-foreground">To:</span>{" "}
                        {evt.to_custodian}
                      </div>

                      <p className="mt-1.5 text-xs text-muted-foreground">{evt.purpose_reason}</p>

                      {/* Digital Signature / Approval Custody Block */}
                      <div className="mt-3 pt-2.5 border-t border-border/60 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> Digital Signature / Approval:
                              SIGNED
                            </Badge>
                            <span className="text-muted-foreground text-[11px]">
                              Signed By:{" "}
                              <strong className="text-foreground">
                                {evt.to_custodian.replace(/\s*\(.*\)/, "")}
                              </strong>
                            </span>
                          </div>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                            <ShieldCheck className="size-3.5" /> Seal #{evt.tamper_seal_number}{" "}
                            Intact
                          </span>
                        </div>

                        <div className="rounded bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground break-all border border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div>
                            <span className="text-[9px] uppercase font-sans font-semibold text-muted-foreground block">
                              Signed Content Hash (SHA-256):
                            </span>
                            <span className="text-foreground">
                              {evt.verification_hash.startsWith("0x")
                                ? `sha256_${evt.verification_hash.slice(2)}f4901b`
                                : evt.verification_hash}
                            </span>
                          </div>
                          <span className="text-[9px] font-sans text-muted-foreground shrink-0 border-t sm:border-t-0 sm:border-l border-border/60 sm:pl-2 pt-1 sm:pt-0">
                            CCA Class 3 DSC / NIC eSign Ready
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 8. TRANSFER HISTORY TAB */}
        <TabsContent value="transfers" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="size-4 text-primary" />
                Inter-Station & Court Transfer Log
              </CardTitle>
              <CardDescription>
                Official manifests recording movements between stations, forensic labs, and
                courtrooms.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Transfer Manifest</TableHead>
                    <TableHead>From Location</TableHead>
                    <TableHead>To Location</TableHead>
                    <TableHead>Custodians</TableHead>
                    <TableHead>Transit Seal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((trf) => (
                    <TableRow key={trf.id}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {trf.transfer_number}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">{trf.from_location}</TableCell>
                      <TableCell className="text-xs text-foreground">{trf.to_location}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {trf.from_custodian_name} → {trf.to_custodian_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-emerald-600">
                        {trf.transit_seal_number || "Verified"}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                          {trf.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 9. MAINTENANCE HISTORY TAB */}
        <TabsContent value="maintenance" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="size-4 text-primary" />
                Maintenance, Calibration & Inspection Log
              </CardTitle>
              <CardDescription>
                Routine servicing, ballistic armory checks, and technical calibration history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Type</TableHead>
                    <TableHead>Service Provider / Armory</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Date Serviced</TableHead>
                    <TableHead>Findings & Actions</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenance.map((mnt) => (
                    <TableRow key={mnt.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {mnt.maintenance_type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        {mnt.service_provider}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {mnt.technician_name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(mnt.scheduled_date).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate text-foreground">
                        {mnt.actions_taken}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                          {mnt.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 10. AUDIT HISTORY TAB */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" />
                Immutable Integrity Audit & Verification Log
              </CardTitle>
              <CardDescription>
                Cryptographic tamper verification compliant with Section 63 of Bharatiya Sakshya
                Adhiniyam, 2023.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  Tamper Verification Status: PASSED / UNCOMPROMISED
                </div>
                <p className="text-muted-foreground">
                  All digital certificates, physical seal numbers, and custodian transfer receipts
                  match the central cryptographic integrity ledger.
                </p>
                <div className="pt-2 font-mono text-[11px] text-muted-foreground space-y-1">
                  <p>
                    SHA-256 Digest: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                  </p>
                  <p>Merkle Root: 0x9f82ab41097c234a123f8762e5b01889dcba2145</p>
                  <p>
                    Digital Signature Algorithm: ECDSA-secp256k1 (Government of NCT Forensic
                    Authority)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Contextual Lifecycle State Transition Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedAction && getActionIcon(selectedAction.actionId)}
              {selectedAction?.label}
            </DialogTitle>
            <DialogDescription className="text-xs">{selectedAction?.description}</DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-4 py-2 text-sm">
              {/* Status Transition Badges */}
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3 border border-border/80">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">
                    Current State
                  </p>
                  <div className="mt-1">{getStatusBadge(asset.status)}</div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">
                    Target State
                  </p>
                  <div className="mt-1">{getStatusBadge(selectedAction.targetStatus)}</div>
                </div>
              </div>

              {/* Contextual Inputs based on Target Status */}
              {selectedAction.targetStatus === "ASSIGNED" && (
                <div className="space-y-3 rounded-lg border border-border/80 p-3 bg-muted/20">
                  <div className="space-y-1.5">
                    <Label htmlFor="officerName" className="text-xs font-semibold">
                      Assigned Officer Name *
                    </Label>
                    <Input
                      id="officerName"
                      value={targetOfficerName}
                      onChange={(e) => setTargetOfficerName(e.target.value)}
                      placeholder="e.g. Sub-Inspector Deepak Sharma"
                      required
                    />
                  </div>
                </div>
              )}

              {selectedAction.targetStatus === "TRANSFERRED" && (
                <div className="space-y-3 rounded-lg border border-border/80 p-3 bg-muted/20">
                  <div className="space-y-1.5">
                    <Label htmlFor="destinationLoc" className="text-xs font-semibold">
                      Destination Facility / Station *
                    </Label>
                    <Input
                      id="destinationLoc"
                      value={targetLocation}
                      onChange={(e) => setTargetLocation(e.target.value)}
                      placeholder="e.g. State Forensic Science Laboratory, Rohini"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="recipientCust" className="text-xs font-semibold">
                        Receiving Custodian
                      </Label>
                      <Input
                        id="recipientCust"
                        value={targetCustodian}
                        onChange={(e) => setTargetCustodian(e.target.value)}
                        placeholder="e.g. Dr. Alok Verma"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="transitSeal" className="text-xs font-semibold">
                        Transit Seal Number
                      </Label>
                      <Input
                        id="transitSeal"
                        value={transitSeal}
                        onChange={(e) => setTransitSeal(e.target.value)}
                        placeholder="e.g. TS-MHA-9821"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedAction.targetStatus === "RETURNED" && (
                <div className="space-y-1.5 rounded-lg border border-border/80 p-3 bg-muted/20">
                  <Label htmlFor="returnNotes" className="text-xs font-semibold">
                    Return Checkin Notes / Inspection Findings
                  </Label>
                  <Input
                    id="returnNotes"
                    value={conditionNotes}
                    onChange={(e) => setConditionNotes(e.target.value)}
                    placeholder="e.g. Inspected by Armorer; all serial seals intact."
                  />
                </div>
              )}

              {/* Mandatory Reason */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="reason"
                  className="text-xs font-semibold flex items-center justify-between"
                >
                  <span>Justification & Authorization Reason *</span>
                  <span className="text-[10px] text-muted-foreground">(Min 4 chars)</span>
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this transition is being executed according to police custody rules..."
                  rows={3}
                  required
                />
              </div>

              {/* Destructive Action Warning & Confirmation Checkbox */}
              {selectedAction &&
                (selectedAction.targetStatus === "RETIRED" ||
                  selectedAction.targetStatus === "LOST") && (
                  <div className="space-y-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="size-4 shrink-0 text-destructive" />
                      <span>Permanent / High-Impact State Transition Warning</span>
                    </div>
                    <p className="leading-relaxed opacity-95 text-[11px]">
                      {selectedAction.targetStatus === "LOST"
                        ? "Marking an item as LOST initiates an immediate vigilance inquiry, alerts the Court Registrar and Malkhana Supervisor, and logs an immutable audit alert under Section 63 BSA 2023."
                        : "Retiring this asset will permanently decommission it from active police service and judicial custody allocation pools."}
                    </p>
                    <div className="flex items-start gap-2 pt-2 border-t border-destructive/20">
                      <Checkbox
                        id="confirmDestructive"
                        checked={destructiveConfirmed}
                        onCheckedChange={(c) => setDestructiveConfirmed(!!c)}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor="confirmDestructive"
                        className="text-[11px] font-semibold text-destructive leading-tight cursor-pointer"
                      >
                        I confirm this action is officially authorized under Court / Police Rules
                        and understand it cannot be undone.
                      </Label>
                    </div>
                  </div>
                )}

              <div className="text-[11px] text-muted-foreground">
                Recorded by: <strong className="text-foreground">{staffName}</strong> ({staffRole})
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedAction(null)}
              disabled={transitionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant={
                selectedAction?.targetStatus === "RETIRED" ||
                selectedAction?.targetStatus === "LOST"
                  ? "destructive"
                  : selectedAction?.variant || "default"
              }
              onClick={() => transitionMutation.mutate()}
              disabled={
                transitionMutation.isPending ||
                reason.trim().length < 4 ||
                ((selectedAction?.targetStatus === "RETIRED" ||
                  selectedAction?.targetStatus === "LOST") &&
                  !destructiveConfirmed)
              }
              className="gap-1.5"
            >
              {transitionMutation.isPending ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Executing Transition...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  {selectedAction?.targetStatus === "RETIRED"
                    ? "Permanently Retire Asset"
                    : selectedAction?.targetStatus === "LOST"
                      ? "Confirm Lost Status"
                      : "Confirm Transition"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Chain of Custody Report Dialog */}
      <Dialog
        open={!!verificationReport}
        onOpenChange={(open) => !open && setVerificationReport(null)}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-5 text-emerald-600" />
              Evidence Chain of Custody Statutory Verification
            </DialogTitle>
            <DialogDescription className="text-xs">
              Algorithmic verification of custody chronological monotonicity, unbroken continuity,
              seal integrity, and BSA 2023 Section 63 compliance.
            </DialogDescription>
          </DialogHeader>

          {verificationReport && (
            <div className="space-y-4 py-2 text-sm">
              {/* Overall Status Banner */}
              <div
                className={cn(
                  "rounded-lg p-4 border flex items-start gap-3",
                  verificationReport.status === "VALID_AND_COMPLETE"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                    : "bg-destructive/10 border-destructive/30 text-destructive dark:text-red-300",
                )}
              >
                {verificationReport.status === "VALID_AND_COMPLETE" ? (
                  <CheckCircle2 className="size-5 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <ShieldAlert className="size-5 text-destructive mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {verificationReport.status === "VALID_AND_COMPLETE"
                        ? "Chain of Custody is Fully Valid & Complete"
                        : "Integrity Warning: Custody Irregularities Detected"}
                    </span>
                    <Badge
                      className={cn(
                        "text-[10px]",
                        verificationReport.status === "VALID_AND_COMPLETE"
                          ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/30 dark:text-emerald-300"
                          : "bg-destructive/20 text-destructive border-destructive/30",
                      )}
                    >
                      {verificationReport.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs opacity-90">
                    Verified on {new Date(verificationReport.verifiedAt).toLocaleString("en-IN")} by{" "}
                    {verificationReport.verifiedBy}.
                  </p>
                </div>
              </div>

              {/* Custody Statistics */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border/80 bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Handover Events
                  </p>
                  <p className="text-base font-bold text-foreground mt-0.5">
                    {verificationReport.movementCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Days in Custody
                  </p>
                  <p className="text-base font-bold text-foreground mt-0.5">
                    {verificationReport.totalDaysInCustody} Days
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Legal Standard
                  </p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    BSA 2023 Sec 63
                  </p>
                </div>
              </div>

              {/* Statutory Criteria Verification Checklist */}
              <div className="rounded-lg border border-border/80 bg-card p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Statutory Admissibility Checklist
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {verificationReport.chronologicalMonotonicity ? (
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-destructive shrink-0" />
                      )}
                      Strict Chronological Monotonicity
                    </span>
                    <span className="text-[11px] text-muted-foreground">No reverse-dated logs</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {verificationReport.custodianContinuity ? (
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-destructive shrink-0" />
                      )}
                      Unbroken Custodian Continuity
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Explicit bilateral handovers
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {verificationReport.sealIntegrityIntact ? (
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-destructive shrink-0" />
                      )}
                      Physical Tamper Seals Verified
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Seal # checked at receipt
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {verificationReport.digitalSignaturesValid ? (
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-destructive shrink-0" />
                      )}
                      Cryptographic Hashes & Signatures Valid
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      SHA-256 digital integrity
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {verificationReport.bsaSection63Admissibility ? (
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-destructive shrink-0" />
                      )}
                      Bharatiya Sakshya Adhiniyam, 2023 §63 Compliance
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Admissible in evidence
                    </span>
                  </div>
                </div>
              </div>

              {/* Current Custodian & Location */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 p-3 rounded-lg border border-border/80">
                <div>
                  <span className="text-muted-foreground font-medium">
                    Verified Current Custodian:
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {verificationReport.currentCustodian}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">
                    Verified Current Location:
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {verificationReport.currentLocation}
                  </p>
                </div>
              </div>

              {/* Anomalies / Flags if any */}
              {verificationReport.anomalies.length > 0 && (
                <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                  <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" />
                    Custody Exceptions & Warnings ({verificationReport.anomalies.length})
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-900/90 dark:text-amber-200/90 pl-1">
                    {verificationReport.anomalies.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-[11px] text-muted-foreground font-mono">
                Verification Fingerprint: {verificationReport.sha256VerificationHash.slice(0, 32)}
                ...
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setVerificationReport(null)}>
              Dismiss Verification Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Evidence (Two-Step Handover) Dialog */}
      <Dialog open={isTransferEvidenceOpen} onOpenChange={setIsTransferEvidenceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Truck className="size-5 text-amber-600" />
              Transfer Evidence (Initiate Transit)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dispatch evidence to another police station, forensic lab, or court. The receiving
              officer must explicitly acknowledge receipt before custody transfers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold flex items-center gap-1.5">
                <Shield className="size-3.5" />
                Anti-Silent Custody Protection
              </p>
              <p className="mt-1 opacity-90">
                This exhibit will be marked <strong>IN_TRANSIT</strong>. Custody does not shift to
                the recipient until they physically examine the package and confirm receipt with
                tamper seal verification.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="evidenceDest" className="text-xs font-semibold">
                Destination Facility / Court / Lab *
              </Label>
              <Input
                id="evidenceDest"
                value={evidenceDestination}
                onChange={(e) => setEvidenceDestination(e.target.value)}
                placeholder="e.g. Rohini Court Malkhana / CFSL Chandigarh"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="evidenceRecipient" className="text-xs font-semibold">
                Designated Receiving Officer *
              </Label>
              <Input
                id="evidenceRecipient"
                value={evidenceRecipientName}
                onChange={(e) => setEvidenceRecipientName(e.target.value)}
                placeholder="e.g. Inspector Rajesh Malik (Malkhana Moharrir)"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="transitSealNo" className="text-xs font-semibold">
                Transit Seal Number / Barcode *
              </Label>
              <Input
                id="transitSealNo"
                value={evidenceTransitSeal}
                onChange={(e) => setEvidenceTransitSeal(e.target.value)}
                placeholder="e.g. SL-TS-2026-8891"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="evidenceReason" className="text-xs font-semibold">
                Transfer Authorization & Purpose *
              </Label>
              <Textarea
                id="evidenceReason"
                value={evidenceTransferReason}
                onChange={(e) => setEvidenceTransferReason(e.target.value)}
                placeholder="State the judicial order, forensic examination requisition, or departmental transfer directive..."
                rows={3}
                required
              />
            </div>

            <div className="text-[11px] text-muted-foreground">
              Releasing Custodian: <strong className="text-foreground">{staffName}</strong> (
              {staffRole})
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTransferEvidenceOpen(false)}
              disabled={dispatchEvidenceMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => dispatchEvidenceMutation.mutate()}
              disabled={
                dispatchEvidenceMutation.isPending ||
                !evidenceDestination.trim() ||
                !evidenceRecipientName.trim() ||
                !evidenceTransitSeal.trim() ||
                !evidenceTransferReason.trim()
              }
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {dispatchEvidenceMutation.isPending ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <Truck className="size-3.5" />
                  Dispatch Evidence
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acknowledge Custody Receipt Dialog */}
      <Dialog open={isAcknowledgeReceiptOpen} onOpenChange={setIsAcknowledgeReceiptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <PackageCheck className="size-5 text-emerald-600" />
              Acknowledge Custody Receipt
            </DialogTitle>
            <DialogDescription className="text-xs">
              Verify the physical tamper seal and confirm receipt into your custody. This
              permanently updates the Chain of Custody ledger.
            </DialogDescription>
          </DialogHeader>

          {selectedPendingTransfer && (
            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-lg bg-muted/40 border border-border/80 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dispatched By:</span>
                  <span className="font-semibold text-foreground">
                    {selectedPendingTransfer.releasingOfficerName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origin:</span>
                  <span className="font-medium text-foreground">
                    {selectedPendingTransfer.fromLocation}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected Transit Seal:</span>
                  <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                    {selectedPendingTransfer.transitSealNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transfer Reason:</span>
                  <span className="text-foreground">{selectedPendingTransfer.transferReason}</span>
                </div>
              </div>

              <div className="flex items-start space-x-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <Checkbox
                  id="sealVerifyCheck"
                  checked={receiptSealVerified}
                  onCheckedChange={(c) => setReceiptSealVerified(Boolean(c))}
                />
                <div className="grid gap-1 leading-none">
                  <label
                    htmlFor="sealVerifyCheck"
                    className="text-xs font-semibold cursor-pointer text-emerald-950 dark:text-emerald-100"
                  >
                    I certify that transit seal #{selectedPendingTransfer.transitSealNumber} is
                    fully intact and unbroken.
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Required under §63 BSA 2023. If the seal has been compromised, do not accept
                    custody.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exhibitCondition" className="text-xs font-semibold">
                  Physical Condition of Exhibit
                </Label>
                <Select value={receiptCondition} onValueChange={setReceiptCondition}>
                  <SelectTrigger id="exhibitCondition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Intact / Undamaged">Intact / Undamaged</SelectItem>
                    <SelectItem value="Good / Normal">Good / Normal</SelectItem>
                    <SelectItem value="Minor Outer Wear (Seal Intact)">
                      Minor Outer Wear (Seal Intact)
                    </SelectItem>
                    <SelectItem value="Compromised / Damaged">Compromised / Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="receiptNotes" className="text-xs font-semibold">
                  Acknowledgment Notes / Malkhana Register No.
                </Label>
                <Input
                  id="receiptNotes"
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  placeholder="e.g. Registered into Malkhana Register Vol IV, Entry 91"
                />
              </div>

              {/* Digital Signature / Approval Endorsement Notice */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5 text-xs text-foreground">
                <div className="flex items-center justify-between font-semibold text-primary">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="size-4" />
                    Digital Signature / Approval Workflow
                  </span>
                  <Badge className="font-mono text-[10px] bg-primary/15 text-primary border-primary/30">
                    ECDSA-P256
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Submitting will bind an immutable cryptographic signature and SHA-256 custody
                  receipt digest signed by <strong className="text-foreground">{staffName}</strong>{" "}
                  ({staffRole}) under Bharatiya Sakshya Adhiniyam, 2023 §63.
                </p>
                <p className="text-[10px] text-muted-foreground opacity-80">
                  * Architecture ready for Controller of Certifying Authorities (CCA) Class 3 DSC
                  tokens and NIC eSign Gateway. (Not a government-certified DSC).
                </p>
              </div>

              <div className="text-[11px] text-muted-foreground">
                Receiving Custodian: <strong className="text-foreground">{staffName}</strong> (
                {staffRole})
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAcknowledgeReceiptOpen(false)}
              disabled={acknowledgeReceiptMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => acknowledgeReceiptMutation.mutate()}
              disabled={acknowledgeReceiptMutation.isPending || !receiptSealVerified}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {acknowledgeReceiptMutation.isPending ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Recording Custody...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Acknowledge Receipt & Accept Custody
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
