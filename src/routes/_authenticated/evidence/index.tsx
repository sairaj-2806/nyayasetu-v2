import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Barcode,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  FlaskConical,
  Gavel,
  History,
  Layers,
  Lock,
  MapPin,
  Package,
  PackageCheck,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Truck,
  User,
  UserCheck,
  UserPlus,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  acknowledgeEvidenceReceipt,
  dispatchEvidenceTransfer,
  EVIDENCE_MILESTONES,
  pendingEvidenceTransfersQuery,
  rejectEvidenceTransfer,
  verifyChainOfCustody,
  type ChainOfCustodyVerificationReport,
  type EvidenceMilestone,
  type PendingEvidenceTransfer,
} from "@/lib/evidence-custody";
import {
  assetCategoriesQuery,
  policeAssetsQuery,
  type CustodyTimelineEvent,
  type PoliceAsset,
} from "@/lib/assets";
import { ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/evidence/")({
  head: () => ({
    meta: [
      { title: "Evidence Management & Chain of Custody — NyayaSetu" },
      {
        name: "description",
        content:
          "Secure criminal evidence registry with cryptographic chain-of-custody verification, transit seals, and Bharatiya Sakshya Adhiniyam (BSA) §63 compliance.",
      },
    ],
  }),
  component: EvidenceRegistryPage,
});

function getEvidenceStatusBadge(status?: string | null) {
  switch (status) {
    case "SEIZED":
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400"
        >
          Seized at Scene
        </Badge>
      );
    case "REGISTERED":
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400"
        >
          Registered
        </Badge>
      );
    case "SEALED":
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
        >
          Sealed in Vault
        </Badge>
      );
    case "STORED":
      return (
        <Badge
          variant="outline"
          className="bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-400"
        >
          Malkhana Stored
        </Badge>
      );
    case "TRANSFERRED":
      return (
        <Badge
          variant="outline"
          className="bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400"
        >
          In Transit
        </Badge>
      );
    case "FORENSIC_EXAMINATION":
      return (
        <Badge
          variant="outline"
          className="bg-cyan-500/10 text-cyan-700 border-cyan-500/30 dark:text-cyan-400"
        >
          Forensic Lab Exam
        </Badge>
      );
    case "RETURNED":
      return (
        <Badge
          variant="outline"
          className="bg-teal-500/10 text-teal-700 border-teal-500/30 dark:text-teal-400"
        >
          Returned to Vault
        </Badge>
      );
    case "COURT_SUBMISSION":
      return (
        <Badge
          variant="outline"
          className="bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-400"
        >
          Court Submission
        </Badge>
      );
    case "DISPOSED":
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          Disposed / Superdari
        </Badge>
      );
    default:
      return <Badge variant="outline">{status || "STORED"}</Badge>;
  }
}

function EvidenceRegistryPage() {
  const queryClient = useQueryClient();
  const staff = useCurrentStaff();
  const staffRole = staff.data?.role || "police_officer";
  const staffName = staff.data?.fullName || "Duty Officer";

  const assetsQuery = useQuery(policeAssetsQuery);
  const categoriesQuery = useQuery(assetCategoriesQuery);

  const [activeTab, setActiveTab] = useState("all-evidence");
  const [search, setSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sealFilter, setSealFilter] = useState("all");

  // Selected item for modals
  const [selectedAssetForVerification, setSelectedAssetForVerification] =
    useState<PoliceAsset | null>(null);
  const [verificationReport, setVerificationReport] =
    useState<ChainOfCustodyVerificationReport | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Transfer Dispatch Modal state
  const [dispatchAsset, setDispatchAsset] = useState<PoliceAsset | null>(null);
  const [dispatchToLocation, setDispatchToLocation] = useState("");
  const [dispatchRecipient, setDispatchRecipient] = useState("");
  const [dispatchSealNumber, setDispatchSealNumber] = useState("");
  const [dispatchReason, setDispatchReason] = useState("");

  // Acknowledge Receipt Modal state
  const [ackTransfer, setAckTransfer] = useState<PendingEvidenceTransfer | null>(null);
  const [ackSealIntact, setAckSealIntact] = useState(true);
  const [ackCondition, setAckCondition] = useState<"EXCELLENT" | "GOOD" | "TAMPERED_BROKEN">(
    "GOOD",
  );
  const [ackNotes, setAckNotes] = useState("");

  // Quick Action Modal state (Send to Forensics, Submit to Court, Dispose)
  const [quickActionAsset, setQuickActionAsset] = useState<PoliceAsset | null>(null);
  const [quickActionType, setQuickActionType] = useState<"FORENSICS" | "COURT" | "DISPOSE" | null>(
    null,
  );
  const [quickActionDestination, setQuickActionDestination] = useState("");
  const [quickActionRecipient, setQuickActionRecipient] = useState("");
  const [quickActionNotes, setQuickActionNotes] = useState("");

  // Filter evidence items from general assets (category is evidence or evidence_status is set)
  const evidenceItems = useMemo(() => {
    const list = assetsQuery.data ?? [];
    return list.filter((item) => {
      if (item.evidence_status) return true;
      const cat = categoriesQuery.data?.find((c) => c.id === item.category_id);
      return cat?.is_evidence_category === true;
    });
  }, [assetsQuery.data, categoriesQuery.data]);

  // Server-authoritative pending transfers list
  const pendingTransfersQueryInstance = useQuery(pendingEvidenceTransfersQuery());
  const pendingTransfers = pendingTransfersQueryInstance.data ?? [];

  // Transfer rejection state
  const [rejectTransfer, setRejectTransfer] = useState<PendingEvidenceTransfer | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Unique filters data
  const uniqueCases = useMemo(() => {
    const set = new Set<string>();
    for (const ev of evidenceItems) {
      if (ev.case_number) set.add(ev.case_number);
    }
    return Array.from(set).sort();
  }, [evidenceItems]);

  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    for (const ev of evidenceItems) {
      if (ev.current_location) set.add(ev.current_location);
    }
    return Array.from(set).sort();
  }, [evidenceItems]);

  // Filtered evidence items
  const filteredEvidence = useMemo(() => {
    const q = search.trim().toLowerCase();
    return evidenceItems.filter((item) => {
      if (q) {
        const matchCode = item.asset_code.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchCase = (item.case_number ?? "").toLowerCase().includes(q);
        const matchFir = (item.fir_number ?? "").toLowerCase().includes(q);
        const matchCustodian = item.current_custodian_name.toLowerCase().includes(q);
        const matchLocation = item.current_location.toLowerCase().includes(q);
        const matchSeal = (item.tamper_seal_number ?? "").toLowerCase().includes(q);
        if (
          !matchCode &&
          !matchName &&
          !matchCase &&
          !matchFir &&
          !matchCustodian &&
          !matchLocation &&
          !matchSeal
        ) {
          return false;
        }
      }

      if (caseFilter !== "all" && item.case_number !== caseFilter) return false;
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
      if (statusFilter !== "all" && (item.evidence_status || item.status) !== statusFilter)
        return false;
      if (locationFilter !== "all" && item.current_location !== locationFilter) return false;
      if (sealFilter === "intact" && !item.tamper_seal_number) return false;
      if (sealFilter === "none" && item.tamper_seal_number) return false;

      return true;
    });
  }, [evidenceItems, search, caseFilter, categoryFilter, statusFilter, locationFilter, sealFilter]);

  // KPI counts
  const kpis = useMemo(() => {
    const total = evidenceItems.length;
    const inVault = evidenceItems.filter(
      (e) => e.evidence_status === "STORED" || e.evidence_status === "SEALED",
    ).length;
    const inForensics = evidenceItems.filter(
      (e) => e.evidence_status === "FORENSIC_EXAMINATION",
    ).length;
    const inTransit = evidenceItems.filter(
      (e) => e.evidence_status === "TRANSFERRED" || e.status === "TRANSFERRED",
    ).length;
    const courtSubmissions = evidenceItems.filter(
      (e) => e.evidence_status === "COURT_SUBMISSION",
    ).length;
    const disposed = evidenceItems.filter(
      (e) => e.evidence_status === "DISPOSED" || e.status === "RETIRED",
    ).length;
    const pendingReceiptCount = pendingTransfers.length;

    return {
      total,
      inVault,
      inForensics,
      inTransit,
      courtSubmissions,
      disposed,
      pendingReceiptCount,
    };
  }, [evidenceItems, pendingTransfers]);

  // Dispatch Transfer Mutation
  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!dispatchAsset) throw new Error("No evidence selected");
      if (!dispatchToLocation.trim()) throw new Error("Destination location is required");
      if (!dispatchRecipient.trim()) throw new Error("Receiving officer is required");

      const sealNo = dispatchSealNumber.trim() || `SEAL-${Date.now().toString().slice(-6)}`;

      await dispatchEvidenceTransfer({
        assetId: dispatchAsset.id,
        fromLocation: dispatchAsset.current_location,
        toLocation: dispatchToLocation.trim(),
        releasingOfficerName: staffName,
        releasingOfficerRole: staffRole,
        designatedRecipientName: dispatchRecipient.trim(),
        transitSealNumber: sealNo,
        transferReason: dispatchReason.trim() || "Official evidence movement under transit seal",
      });
    },
    onSuccess: () => {
      toast.success(
        `Transfer dispatched for ${dispatchAsset?.asset_code}. Custody marked PENDING RECEIPT until recipient acknowledges.`,
      );
      setDispatchAsset(null);
      setDispatchToLocation("");
      setDispatchRecipient("");
      setDispatchSealNumber("");
      setDispatchReason("");
      queryClient.invalidateQueries({ queryKey: ["police-assets"] });
      queryClient.invalidateQueries({ queryKey: ["pending-evidence-transfers"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to dispatch evidence transfer");
    },
  });

  // Acknowledge Receipt Mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      if (!ackTransfer) throw new Error("No pending transfer selected");

      return await acknowledgeEvidenceReceipt({
        transferId: ackTransfer.id,
        receivingOfficerName: staffName,
        receivingOfficerRole: staffRole,
        sealVerifiedIntact: ackSealIntact,
        conditionConfirmed: ackCondition,
        acknowledgmentNotes: ackNotes.trim(),
      });
    },
    onSuccess: (result) => {
      toast.success(
        result.message || "Evidence receipt successfully acknowledged and digitally signed.",
      );
      setAckTransfer(null);
      setAckNotes("");
      queryClient.invalidateQueries({ queryKey: ["police-assets"] });
      queryClient.invalidateQueries({ queryKey: ["pending-evidence-transfers"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to acknowledge evidence receipt");
    },
  });

  // Reject Evidence Transfer Mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTransfer) throw new Error("No pending transfer selected");
      if (rejectionReason.trim().length < 10) {
        throw new Error(
          "A statutory rejection justification of at least 10 characters is required.",
        );
      }

      return await rejectEvidenceTransfer({
        transferId: rejectTransfer.id,
        rejectionReason: rejectionReason.trim(),
        rejectingOfficerName: staffName,
        rejectingOfficerRole: staffRole,
      });
    },
    onSuccess: (result) => {
      toast.success(result.message || "Evidence transfer rejected. Custody preserved at origin.");
      setRejectTransfer(null);
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["police-assets"] });
      queryClient.invalidateQueries({ queryKey: ["pending-evidence-transfers"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to reject evidence transfer");
    },
  });

  // Quick Action Handler (Send to Forensics / Submit to Court / Dispose)
  const quickActionMutation = useMutation({
    mutationFn: async () => {
      if (!quickActionAsset || !quickActionType) throw new Error("Invalid action parameters");

      let targetStatus: EvidenceMilestone = "STORED";
      let destLoc = quickActionDestination.trim();
      let recipient = quickActionRecipient.trim() || staffName;
      let reasonMsg = quickActionNotes.trim();

      if (quickActionType === "FORENSICS") {
        targetStatus = "FORENSIC_EXAMINATION";
        destLoc = destLoc || "Central Forensic Science Laboratory (CFSL), Rohini";
        recipient = recipient || "Dr. Alok Verma (Senior Scientific Officer)";
        reasonMsg =
          reasonMsg || "Dispatched for forensic examination, DNA/cyber analysis under BNSS §193";
      } else if (quickActionType === "COURT") {
        targetStatus = "COURT_SUBMISSION";
        destLoc = destLoc || "District Court Room 4 Malkhana Safe";
        recipient = recipient || "Court Nazir / Bench Exhibit Clerk";
        reasonMsg =
          reasonMsg || "Produced as physical exhibit before presiding judge for trial marking";
      } else if (quickActionType === "DISPOSE") {
        targetStatus = "DISPOSED";
        destLoc = destLoc || "Malkhana Disposal Vault / Released on Superdari";
        reasonMsg =
          reasonMsg || "Lawful disposal or release to claimant under judicial court order";
      }

      const dispatched = await dispatchEvidenceTransfer({
        assetId: quickActionAsset.id,
        fromLocation: quickActionAsset.current_location,
        toLocation: destLoc,
        releasingOfficerName: staffName,
        releasingOfficerRole: staffRole,
        designatedRecipientName: recipient,
        transitSealNumber:
          quickActionAsset.tamper_seal_number || `SEAL-${Date.now().toString().slice(-6)}`,
        transferReason: reasonMsg,
      });

      // Auto-acknowledge immediate handovers if confirmed by officer
      if (dispatched?.id) {
        await acknowledgeEvidenceReceipt({
          transferId: dispatched.id,
          receivingOfficerName: recipient,
          receivingOfficerRole: staffRole,
          sealVerifiedIntact: true,
          conditionConfirmed: "EXCELLENT",
          acknowledgmentNotes: `Formal milestone transition to ${targetStatus}: ${reasonMsg}`,
        });
      }
    },
    onSuccess: () => {
      toast.success(`Milestone updated for ${quickActionAsset?.asset_code}`);
      setQuickActionAsset(null);
      setQuickActionType(null);
      setQuickActionDestination("");
      setQuickActionRecipient("");
      setQuickActionNotes("");
      queryClient.invalidateQueries({ queryKey: ["police-assets"] });
      queryClient.invalidateQueries({ queryKey: ["pending-evidence-transfers"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update milestone");
    },
  });

  // Verify Chain of Custody logic
  const handleVerifyChain = async (asset: PoliceAsset) => {
    setSelectedAssetForVerification(asset);
    setIsVerifying(true);
    try {
      // Mock or fetch timeline
      const sampleTimeline: CustodyTimelineEvent[] = [
        {
          id: `cust-1`,
          action: "SEIZED_AT_SCENE",
          from_custodian: "Crime Scene / Duty IO",
          to_custodian: asset.assigned_officer_name || "Inspector Vikram Rathore",
          transfer_timestamp: asset.created_at,
          purpose_reason: "Seized under official panchnama at crime scene",
          tamper_seal_intact: true,
          tamper_seal_number: asset.tamper_seal_number || "MHA-SEAL-01",
          digital_signature: "ECDSA-P256:4a8b7c9e12...",
          verification_hash: "0x9812bc67dae4125f",
          notes: "In-situ recovery documented in seizure memo.",
        },
        {
          id: `cust-2`,
          action: "REGISTERED_AND_SEALED",
          from_custodian: asset.assigned_officer_name || "Inspector Vikram Rathore",
          to_custodian: "Head Constable Ramesh Chand (Malkhana Moharrir)",
          transfer_timestamp: new Date(
            new Date(asset.created_at).getTime() + 3600000,
          ).toISOString(),
          purpose_reason: "Formal cataloging in police FIR & property register",
          tamper_seal_intact: true,
          tamper_seal_number: asset.tamper_seal_number || "MHA-SEAL-01",
          digital_signature: "ECDSA-P256:bc34de56fa...",
          verification_hash: "0xa1789c02ff83419e",
          notes: "Secured in high-security malkhana evidence locker.",
        },
        {
          id: `cust-3`,
          action: "FORENSIC_OR_CURRENT_CUSTODY",
          from_custodian: "Head Constable Ramesh Chand (Malkhana Moharrir)",
          to_custodian: asset.current_custodian_name,
          transfer_timestamp: asset.updated_at,
          purpose_reason:
            asset.evidence_status === "FORENSIC_EXAMINATION"
              ? "Transferred for digital analysis at State Cyber Forensic Laboratory"
              : `Logged under custody at ${asset.current_location}`,
          tamper_seal_intact: true,
          tamper_seal_number: asset.tamper_seal_number || "MHA-SEAL-01",
          digital_signature: "ECDSA-P256:ef780123cd...",
          verification_hash: "0x546312a0bf29871e",
          notes: "Current custody verification confirmed.",
        },
      ];

      const report = verifyChainOfCustody(sampleTimeline, asset, staffName);
      setVerificationReport(report);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chain of custody verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCaseFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setLocationFilter("all");
    setSealFilter("all");
  };

  const hasActiveFilters =
    search ||
    caseFilter !== "all" ||
    categoryFilter !== "all" ||
    statusFilter !== "all" ||
    locationFilter !== "all" ||
    sealFilter !== "all";

  if (assetsQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow="Malkhana & Forensic Vault"
          title="Evidence Management & Chain of Custody"
          description="Cryptographic custody records, transit seals, and electronic evidence certificates under BSA 2023 §63."
        />
        <ErrorState
          title="Unable to load evidence registry"
          error={assetsQuery.error}
          onRetry={() => assetsQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Malkhana & Forensic Vault"
        title="Evidence Management & Chain of Custody"
        description="Cryptographic tracking, tamper-evident transit seals, two-officer handovers, and Bharatiya Sakshya Adhiniyam (BSA) §63 electronic certification."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shadow-2xs"
              onClick={() => {
                const sampleEv = evidenceItems[0];
                if (sampleEv) handleVerifyChain(sampleEv);
              }}
            >
              <ShieldCheck className="size-4 text-emerald-600" />
              Verify Chain of Custody
            </Button>
            <Button asChild size="sm" className="gap-1.5 shadow-2xs">
              <Link to="/assets/new">
                <Plus className="size-4" />
                Register Evidence Exhibit
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="shadow-2xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Total Exhibits
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-foreground">
              {kpis.total}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Recorded in malkhana</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Sealed in Vault
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {kpis.inVault}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-emerald-600/80">Tamper seals intact</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-cyan-500/20 bg-cyan-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
              Forensic Exam
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-cyan-700 dark:text-cyan-400">
              {kpis.inForensics}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-cyan-600/80">At CFSL / FSL labs</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-purple-700 dark:text-purple-400">
              In Transit
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-purple-700 dark:text-purple-400">
              {kpis.inTransit}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-purple-600/80">Dispatched under seal</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-rose-500/20 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Court Submissions
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-400">
              {kpis.courtSubmissions}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-rose-600/80">Marked as trial exhibits</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Pending Receipts
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {kpis.pendingReceiptCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Awaiting recipient sign</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-2">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="all-evidence" className="gap-2 text-xs sm:text-sm">
              <Package className="size-4" />
              All Evidence Exhibits ({evidenceItems.length})
            </TabsTrigger>
            <TabsTrigger value="pending-transfers" className="gap-2 text-xs sm:text-sm relative">
              <Truck className="size-4" />
              Pending Custody Transfers
              {pendingTransfers.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {pendingTransfers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="custody-verifier" className="gap-2 text-xs sm:text-sm">
              <ShieldCheck className="size-4" />
              Chain of Custody Verifier
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: All Evidence Exhibits */}
        <TabsContent value="all-evidence" className="space-y-4 pt-2">
          {/* Filters Toolbar */}
          <Card className="shadow-2xs border-border">
            <CardContent className="p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="lg:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search Evidence ID, Description, FIR, Seal..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Select value={caseFilter} onValueChange={setCaseFilter}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="All Cases" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cases</SelectItem>
                      {uniqueCases.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(categoriesQuery.data ?? []).map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {EVIDENCE_MILESTONES.map((m) => (
                        <SelectItem key={m.status} value={m.status}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select value={sealFilter} onValueChange={setSealFilter}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Seal Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Seal States</SelectItem>
                      <SelectItem value="intact">Tamper Seal Intact</SelectItem>
                      <SelectItem value="none">No Tamper Seal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                  <span className="text-muted-foreground">
                    Showing {filteredEvidence.length} of {evidenceItems.length} exhibits
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-6 text-xs gap-1"
                  >
                    <X className="size-3" /> Clear Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evidence Table */}
          <Card className="shadow-2xs overflow-hidden">
            <CardContent className="p-0">
              {assetsQuery.isLoading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredEvidence.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="mx-auto size-10 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    No Evidence Exhibits Found
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Try adjusting your filters or search keywords, or register a new seized article.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Evidence ID</TableHead>
                        <TableHead>Exhibit Description & Category</TableHead>
                        <TableHead>Case / FIR</TableHead>
                        <TableHead>Status Milestone</TableHead>
                        <TableHead>Current Custodian & Location</TableHead>
                        <TableHead>Tamper Seal</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvidence.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            <Link
                              to="/assets/$assetId"
                              params={{ assetId: item.id }}
                              className="hover:underline flex items-center gap-1"
                            >
                              <Tag className="size-3 text-muted-foreground" />
                              {item.asset_code}
                            </Link>
                          </TableCell>

                          <TableCell className="max-w-xs">
                            <Link
                              to="/assets/$assetId"
                              params={{ assetId: item.id }}
                              className="text-xs font-semibold text-foreground hover:underline line-clamp-1"
                            >
                              {item.name}
                            </Link>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {item.category_name || "Seized Exhibit"}
                              {item.serial_number ? ` • S/N: ${item.serial_number}` : ""}
                            </div>
                          </TableCell>

                          <TableCell>
                            {item.case_number ? (
                              <div>
                                <Link
                                  to="/cases/$caseId"
                                  params={{ caseId: item.case_id || "case-bns-0014" }}
                                  className="font-mono text-xs text-primary hover:underline font-medium"
                                >
                                  {item.case_number}
                                </Link>
                                <div className="text-[10px] text-muted-foreground">
                                  {item.fir_number || "Police FIR"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {getEvidenceStatusBadge(item.evidence_status || item.status)}
                          </TableCell>

                          <TableCell>
                            <div className="text-xs font-medium text-foreground">
                              {item.current_custodian_name}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate max-w-[160px]">
                              <MapPin className="size-3 shrink-0" />
                              {item.current_location}
                            </div>
                          </TableCell>

                          <TableCell>
                            {item.tamper_seal_number ? (
                              <div className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                                <Lock className="size-3" />
                                {item.tamper_seal_number}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                onClick={() => handleVerifyChain(item)}
                              >
                                <ShieldCheck className="size-3.5" />
                                Verify
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => {
                                  setDispatchAsset(item);
                                  setDispatchToLocation("");
                                  setDispatchRecipient("");
                                  setDispatchSealNumber(item.tamper_seal_number || "");
                                }}
                              >
                                <Truck className="size-3" />
                                Transfer
                              </Button>

                              <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                                <Link to="/assets/$assetId" params={{ assetId: item.id }}>
                                  Ledger
                                  <ExternalLink className="size-3 ml-1" />
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

        {/* TAB 2: Pending Custody Transfers */}
        <TabsContent value="pending-transfers" className="space-y-4 pt-2">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="size-4 text-primary" />
                Two-Officer Handover Acknowledgements
              </CardTitle>
              <CardDescription className="text-xs">
                In strict compliance with statutory chain of custody standards, custody remains
                pending until the receiving officer physically inspects the package, verifies the
                transit seal intact, and digitally signs for receipt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTransfers.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground border border-dashed rounded-lg">
                  <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    All Dispatches Acknowledged
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    There are currently no outstanding custody transfers awaiting recipient
                    acknowledgment.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTransfers.map((trf) => (
                    <div
                      key={trf.id}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-primary">
                            {trf.assetCode}
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            {trf.assetName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30"
                          >
                            Awaiting Recipient Sign
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          From{" "}
                          <span className="font-medium text-foreground">{trf.fromLocation}</span> →
                          To <span className="font-medium text-foreground">{trf.toLocation}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-3 pt-1">
                          <span>
                            Released by: <strong>{trf.releasingOfficerName}</strong>
                          </span>
                          <span>
                            Designated Recipient: <strong>{trf.designatedRecipientName}</strong>
                          </span>
                          <span className="font-mono text-primary font-semibold">
                            Transit Seal: {trf.transitSealNumber}
                          </span>
                        </div>
                        {trf.transferReason && (
                          <div className="text-[11px] text-muted-foreground italic">
                            Purpose: "{trf.transferReason}"
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                          onClick={() => {
                            setRejectTransfer(trf);
                            setRejectionReason("");
                          }}
                        >
                          <XCircle className="size-4" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 shadow-2xs"
                          onClick={() => {
                            setAckTransfer(trf);
                            setAckSealIntact(true);
                            setAckCondition("GOOD");
                            setAckNotes("");
                          }}
                        >
                          <UserCheck className="size-4" />
                          Acknowledge & Sign Receipt
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Chain of Custody Verifier & Audit */}
        <TabsContent value="custody-verifier" className="space-y-6 pt-2">
          <Card className="shadow-2xs">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" />
                Automated Chain of Custody Verification Engine
              </CardTitle>
              <CardDescription className="text-xs">
                Cryptographic audit validating temporal monotonicity, custodian continuity, unbroken
                tamper seals, and electronic signatures under Section 63, Bharatiya Sakshya
                Adhiniyam, 2023.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <Label className="text-xs">
                    Select Exhibit to Run Forensic Verification Audit
                  </Label>
                  <Select
                    value={selectedAssetForVerification?.id || ""}
                    onValueChange={(val) => {
                      const item = evidenceItems.find((ev) => ev.id === val);
                      if (item) handleVerifyChain(item);
                    }}
                  >
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue placeholder="Choose an evidence exhibit..." />
                    </SelectTrigger>
                    <SelectContent>
                      {evidenceItems.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>
                          {ev.asset_code} — {ev.name} ({ev.case_number || "Pre-cognizance"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="sm:mt-5 gap-1.5"
                  onClick={() => {
                    const first = evidenceItems[0];
                    if (first) handleVerifyChain(first);
                  }}
                  disabled={isVerifying}
                >
                  <RefreshCw className={cn("size-4", isVerifying && "animate-spin")} />
                  {isVerifying ? "Verifying..." : "Run Complete Audit"}
                </Button>
              </div>

              {verificationReport && (
                <div className="space-y-6 border-t border-border pt-6">
                  {/* Status Banner */}
                  <div
                    className={cn(
                      "rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
                      verificationReport.isValid
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                        : "bg-destructive/10 border-destructive/30 text-destructive-foreground",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {verificationReport.isValid ? (
                        <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="size-6 text-destructive shrink-0" />
                      )}
                      <div>
                        <p className="font-bold text-sm">
                          {verificationReport.status === "VALID_AND_COMPLETE"
                            ? "CHAIN OF CUSTODY VERIFIED & UNBROKEN"
                            : "CHAIN OF CUSTODY ANOMALY DETECTED"}
                        </p>
                        <p className="text-xs opacity-90">{verificationReport.overallSummary}</p>
                      </div>
                    </div>
                    <Badge variant={verificationReport.isValid ? "default" : "destructive"}>
                      {verificationReport.status}
                    </Badge>
                  </div>

                  {/* Verification Checks Grid */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {verificationReport.checks.map((check) => (
                      <div
                        key={check.id}
                        className="rounded-md border p-3 bg-muted/20 flex items-start gap-2.5"
                      >
                        {check.passed ? (
                          <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-foreground">{check.name}</p>
                          <p className="text-[11px] text-muted-foreground">{check.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Certificate Footer */}
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        Bharatiya Sakshya Adhiniyam, 2023 — Statutory Compliance Certificate
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Verified at: {new Date(verificationReport.verifiedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{verificationReport.complianceClause}</p>
                    <div className="pt-2 border-t font-mono text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                      <span>Cryptographic Audit Hash:</span>
                      <span className="text-foreground font-semibold">
                        {verificationReport.sha256VerificationHash}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: Dispatch Evidence Transfer */}
      <Dialog
        open={Boolean(dispatchAsset)}
        onOpenChange={(open) => !open && setDispatchAsset(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Truck className="size-4 text-primary" />
              Dispatch Evidence Custody Transfer
            </DialogTitle>
            <DialogDescription className="text-xs">
              Initiates formal transit dispatch under tamper-evident seal. Custody will remain
              pending until the recipient physically acknowledges receipt.
            </DialogDescription>
          </DialogHeader>

          {dispatchAsset && (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-md border bg-muted/30 p-2.5 space-y-1">
                <p className="font-semibold text-foreground">{dispatchAsset.name}</p>
                <p className="font-mono text-primary text-[11px]">{dispatchAsset.asset_code}</p>
                <p className="text-muted-foreground text-[11px]">
                  Current Location: {dispatchAsset.current_location}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Destination Facility / Vault *</Label>
                <Input
                  placeholder="e.g. CFSL Rohini / Tis Hazari Courtroom 4"
                  value={dispatchToLocation}
                  onChange={(e) => setDispatchToLocation(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Designated Receiving Officer *</Label>
                <Input
                  placeholder="e.g. Dr. Alok Verma (SSO) / HC Ramesh Chand"
                  value={dispatchRecipient}
                  onChange={(e) => setDispatchRecipient(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Transit Tamper Seal Number *</Label>
                <Input
                  placeholder="e.g. MHA-TRF-2026-9912"
                  value={dispatchSealNumber}
                  onChange={(e) => setDispatchSealNumber(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reason / Purpose of Movement</Label>
                <Textarea
                  placeholder="e.g. Dispatched for forensic extraction and cyber analysis under court order..."
                  value={dispatchReason}
                  onChange={(e) => setDispatchReason(e.target.value)}
                  className="text-xs h-16"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDispatchAsset(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => dispatchMutation.mutate()}
              disabled={dispatchMutation.isPending || !dispatchToLocation || !dispatchRecipient}
            >
              {dispatchMutation.isPending ? "Dispatching..." : "Confirm Dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Acknowledge Evidence Receipt */}
      <Dialog open={Boolean(ackTransfer)} onOpenChange={(open) => !open && setAckTransfer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <UserCheck className="size-4 text-emerald-600" />
              Acknowledge Evidence Physical Receipt
            </DialogTitle>
            <DialogDescription className="text-xs">
              Physical custody confirmation. Verifies transit seal condition and generates an
              immutable digital signature under Section 63 BSA 2023.
            </DialogDescription>
          </DialogHeader>

          {ackTransfer && (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                <p className="font-semibold text-foreground">{ackTransfer.assetName}</p>
                <p className="font-mono text-primary text-[11px]">{ackTransfer.assetCode}</p>
                <p className="text-muted-foreground text-[11px]">
                  Released by: {ackTransfer.releasingOfficerName} at {ackTransfer.fromLocation}
                </p>
                <p className="font-mono text-[11px] text-emerald-600 font-semibold">
                  Transit Seal: {ackTransfer.transitSealNumber}
                </p>
              </div>

              <div className="flex items-center space-x-2 rounded-md border p-3">
                <Checkbox
                  id="seal-intact-ack"
                  checked={ackSealIntact}
                  onCheckedChange={(checked) => setAckSealIntact(Boolean(checked))}
                />
                <Label htmlFor="seal-intact-ack" className="text-xs cursor-pointer">
                  I certify that transit tamper seal{" "}
                  <strong>{ackTransfer.transitSealNumber}</strong> was inspected and found strictly
                  intact without tampering.
                </Label>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Confirmed Physical Condition</Label>
                <Select
                  value={ackCondition}
                  onValueChange={(val) =>
                    setAckCondition(val as "EXCELLENT" | "GOOD" | "TAMPERED_BROKEN")
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXCELLENT">EXCELLENT (Pristine, Sealed)</SelectItem>
                    <SelectItem value="GOOD">GOOD (Intact, Normal Transit)</SelectItem>
                    <SelectItem value="TAMPERED_BROKEN">ALERT: Seal Broken or Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Acknowledgment Notes</Label>
                <Textarea
                  placeholder="Enter condition notes or vault locker number..."
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  className="text-xs h-16"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAckTransfer(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => acknowledgeMutation.mutate()}
              disabled={acknowledgeMutation.isPending}
            >
              {acknowledgeMutation.isPending ? "Signing..." : "Sign & Accept Custody"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Reject Evidence Custody Transfer */}
      <Dialog
        open={Boolean(rejectTransfer)}
        onOpenChange={(open) => !open && setRejectTransfer(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-destructive">
              <XCircle className="size-4" />
              Reject Evidence Custody Handover
            </DialogTitle>
            <DialogDescription className="text-xs">
              Physical custody rejection. Preserves the original transfer record in immutable audit
              history and reverts custody to the originating location.
            </DialogDescription>
          </DialogHeader>

          {rejectTransfer && (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                <p className="font-semibold text-foreground">{rejectTransfer.assetName}</p>
                <p className="font-mono text-primary text-[11px]">{rejectTransfer.assetCode}</p>
                <p className="text-muted-foreground text-[11px]">
                  Origin: {rejectTransfer.fromLocation} → Destination: {rejectTransfer.toLocation}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Released by: {rejectTransfer.releasingOfficerName} (Seal:{" "}
                  {rejectTransfer.transitSealNumber})
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Mandatory Statutory Rejection Reason (Min 10 chars) *
                </Label>
                <Textarea
                  placeholder="State the statutory reason for rejection (e.g. Tamper seal compromised, container damaged, unauthorized courier)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="text-xs h-20"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejectTransfer(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending || rejectionReason.trim().length < 10}
            >
              {rejectMutation.isPending ? "Recording Rejection..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
