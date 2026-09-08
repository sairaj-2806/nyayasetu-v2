import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileCheck2,
  FileCode,
  FileDown,
  FilePlus,
  FileSpreadsheet,
  FileText,
  Gavel,
  History,
  Lock,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Split,
  Tag,
  Upload,
  User,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/states";
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
import { useCurrentStaff, usePermissions } from "@/hooks/use-current-staff";
import { canAccessDocumentRecord } from "@/lib/rbac";
import { compareDocumentVersions, type VersionComparisonReport } from "@/lib/document-comparison";
import {
  createNewDocumentVersion,
  recordDocumentAccess,
  restoreDocumentContent,
  secureDocumentDetailQuery,
  simulateDocumentTamper,
  verifyDocumentVersionIntegrity,
  type DocumentCategory,
  type DocumentIntegrityResult,
  type DocumentSensitivityTier,
  type DocumentVersionRecord,
  type SecureDocument,
} from "@/lib/documents";
import {
  getAllDigitalSignatures,
  getDocumentVersionSignature,
  signDocumentVersion,
  SIGNATURE_PROVIDER_DECLARATION,
  type DigitalSignatureRecord,
  type SignatureStatus,
} from "@/lib/digital-signature";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/documents/$documentId")({
  head: () => ({
    meta: [
      { title: "Document Particulars & Cryptographic Dossier — NyayaSetu" },
      {
        name: "description",
        content:
          "Verified legal document preview, immutable version tree, and cryptographic proof under BSA §63.",
      },
    ],
  }),
  component: DocumentDetailPage,
});

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

/**
 * Standard Document Integrity Status Card
 * Displays exact requested format:
 * Document Integrity
 * ✓ VERIFIED / ✗ INTEGRITY MISMATCH / ⚠️ UNAVAILABLE
 * SHA-256
 * Version
 * Verified At
 */
function IntegrityStatusCard({
  result,
  onTamper,
  onRestore,
  onReverify,
  isVerifying,
}: {
  result: DocumentIntegrityResult;
  onTamper?: (() => void) | undefined;
  onRestore?: (() => void) | undefined;
  onReverify?: (() => void) | undefined;
  isVerifying?: boolean | undefined;
}) {
  return (
    <div className="space-y-4">
      {/* Primary Status Card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
        {/* 1. Document Integrity Status */}
        <div className="flex flex-col gap-1.5 border-b border-border/60 pb-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Document Integrity
          </p>
          {result.status === "VERIFIED" ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-lg">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>✓ VERIFIED</span>
            </div>
          ) : result.status === "INTEGRITY_MISMATCH" ? (
            <div className="flex items-center gap-2 text-destructive font-bold text-lg">
              <XCircle className="size-5 shrink-0" />
              <span>✗ INTEGRITY MISMATCH</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-lg">
              <AlertTriangle className="size-5 shrink-0" />
              <span>⚠️ UNAVAILABLE</span>
            </div>
          )}
        </div>

        {/* 2. SHA-256 Hash */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            SHA-256
          </p>
          <div className="rounded-md bg-muted/40 p-3 font-mono text-xs text-foreground break-all border border-border/60">
            {result.status === "INTEGRITY_MISMATCH" ? (
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-destructive uppercase font-sans font-bold block">
                    Calculated Hash from Current File (Altered):
                  </span>
                  <span className="text-destructive font-bold">{result.computedSha256}</span>
                </div>
                <div className="border-t border-border/40 pt-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold block">
                    Immutable Recorded Deposit Hash (Preserved):
                  </span>
                  <span className="text-foreground">{result.recordedSha256}</span>
                </div>
              </div>
            ) : (
              <span>{result.computedSha256 || result.recordedSha256}</span>
            )}
          </div>
        </div>

        {/* 3. Version & Verified At */}
        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-3">
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Version
            </p>
            <p className="font-mono text-base font-bold text-foreground">{result.versionNumber}</p>
          </div>

          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Verified At
            </p>
            <p className="text-sm font-medium text-foreground">
              {new Date(result.verifiedAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              {new Date(result.verifiedAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Security Alert Banner on Integrity Failure */}
      {result.status === "INTEGRITY_MISMATCH" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="size-4.5 shrink-0" />
            HIGH-PRIORITY SECURITY AUDIT ALERT DISPATCHED
          </div>
          <p className="text-[11px] opacity-95 leading-relaxed">
            The cryptographic checksum of the current file does not match the immutable recorded
            deposit hash! A high-priority security event has been automatically written to the
            platform audit logs.
          </p>
          <div className="font-semibold text-[11px] border-t border-destructive/20 pt-1.5">
            🔒 Original deposit hash is strictly preserved and was NOT overwritten.
          </div>
        </div>
      )}

      {/* Statutory Admissibility Notice */}
      <div className="rounded-lg border border-border/80 bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">
          Statutory Admissibility (Bharatiya Sakshya Adhiniyam, 2023 §63)
        </p>
        <p>{result.bsaSection63Clause}</p>
      </div>

      {/* Consortium Blockchain / Immutable Ledger Architecture Panel */}
      <div className="rounded-lg border border-border/80 bg-muted/15 p-4 space-y-2.5 text-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Scale className="size-3.5 text-primary" />
            Consortium Ledger Anchoring Readiness
          </span>
          <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
            {result.ledgerAnchor.anchorSchema}
          </Badge>
        </div>

        <div className="space-y-1.5 text-[11px] text-muted-foreground font-mono">
          <div>
            <span className="text-foreground font-sans font-semibold">Target Ledger:</span>{" "}
            {result.ledgerAnchor.targetLedgerName}
          </div>
          <div className="truncate">
            <span className="text-foreground font-sans font-semibold">Merkle Leaf:</span>{" "}
            {result.ledgerAnchor.merkleLeafHash}
          </div>
          <div className="truncate">
            <span className="text-foreground font-sans font-semibold">Merkle Root:</span>{" "}
            {result.ledgerAnchor.merkleRoot}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/40 leading-relaxed">
          Architectural Note: SHA-256 provides local deterministic integrity verification. The
          system is designed so hashes are pre-formatted as RFC-6962 Merkle tree leaves and can be
          anchored to an immutable permissioned blockchain ledger for multi-agency non-repudiation
          across Police, Prosecution, and Judiciary.
        </p>
      </div>

      {/* Interactive Audit Testing Controls (Tamper Simulation) */}
      {(onTamper || onRestore) && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3.5 space-y-2 text-xs">
          <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
            Integrity Verification & Tamper Simulation Testing
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {onTamper && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={onTamper}
                disabled={isVerifying}
              >
                Simulate File Corruption / Tamper
              </Button>
            )}
            {onRestore && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={onRestore}
                disabled={isVerifying}
              >
                Restore Authentic File
              </Button>
            )}
            {onReverify && (
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={onReverify}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <RefreshCw className="size-3 animate-spin" />
                ) : (
                  <ShieldCheck className="size-3" />
                )}
                Re-Verify Integrity
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Standard Digital Signature / Approval Status Card
 * Displays exact requested format:
 *
 * Signature Status:
 * PENDING / SIGNED / INVALID
 *
 * Signed By:
 * [User]
 *
 * Signed At:
 * [Timestamp]
 *
 * Signed Version:
 * [V3]
 *
 * Signed Content Hash:
 * [SHA-256]
 */
function DigitalSignatureStatusCard({
  status,
  signature,
  versionNumber,
  contentHash,
  onOpenSignModal,
  isHistorical,
  canSign = true,
}: {
  status: SignatureStatus;
  signature?: DigitalSignatureRecord | null | undefined;
  versionNumber: number;
  contentHash: string;
  onOpenSignModal: () => void;
  isHistorical?: boolean | undefined;
  canSign?: boolean | undefined;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5 shadow-xs">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileCheck2 className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Digital Signature / Approval
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Cryptographic endorsement tied strictly to Document Version v{versionNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono bg-muted/30 px-2 py-0.5">
            Snapshot: v{versionNumber}
          </Badge>
          {canSign ? (
            <Button size="sm" onClick={onOpenSignModal} className="gap-1.5 text-xs h-8">
              <FileCheck className="size-3.5" />
              {status === "SIGNED" ? "Re-Endorse / Sign" : "Digital Signature / Approval"}
            </Button>
          ) : (
            <Badge
              variant="outline"
              className="text-xs text-muted-foreground gap-1 py-1 px-2 border-border/80"
            >
              <Lock className="size-3" />
              Signing Restricted
            </Badge>
          )}
        </div>
      </div>

      {/* 1. Signature Status */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Signature Status:
        </p>
        <div className="pt-0.5">
          {status === "SIGNED" ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-lg">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>SIGNED</span>
              <span className="text-xs font-normal text-muted-foreground">
                (Verified Cryptographic Binding)
              </span>
            </div>
          ) : status === "INVALID" ? (
            <div className="flex items-center gap-2 text-destructive font-bold text-lg">
              <XCircle className="size-5 shrink-0" />
              <span>INVALID</span>
              <span className="text-xs font-normal text-destructive/80">
                (Integrity Mismatch or Tamper Detected)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-lg">
              <Clock className="size-5 shrink-0" />
              <span>PENDING</span>
              <span className="text-xs font-normal text-muted-foreground">
                (Awaiting Authorized Official Approval)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Signed By */}
      <div className="space-y-1 border-t border-border/40 pt-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Signed By:
        </p>
        <div className="text-sm font-semibold text-foreground">
          {signature ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-foreground">{signature.signer_user}</span>
              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                {signature.signer_role.replace(/_/g, " ")}
              </Badge>
              {signature.signer_department && (
                <span className="text-xs text-muted-foreground font-normal">
                  • {signature.signer_department}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground italic font-normal">
              [Pending Official Endorsement]
            </span>
          )}
        </div>
      </div>

      {/* 3. Signed At */}
      <div className="space-y-1 border-t border-border/40 pt-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Signed At:
        </p>
        <p className="text-sm font-medium text-foreground">
          {signature?.signed_at ? (
            <span>
              {new Date(signature.signed_at).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          ) : (
            <span className="text-muted-foreground italic font-normal">[Not Yet Executed]</span>
          )}
        </p>
      </div>

      {/* 4. Signed Version */}
      <div className="space-y-1 border-t border-border/40 pt-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Signed Version:
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm text-foreground bg-muted/60 px-2.5 py-0.5 rounded border border-border/60">
            [V{versionNumber}]
          </span>
          <span className="text-xs text-muted-foreground">
            {isHistorical
              ? `(Immutable historical snapshot v${versionNumber})`
              : `(Current active version v${versionNumber} — not shared across versions)`}
          </span>
        </div>
      </div>

      {/* 5. Signed Content Hash */}
      <div className="space-y-1.5 border-t border-border/40 pt-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Signed Content Hash:
        </p>
        <div className="rounded-md bg-muted/40 p-3 font-mono text-xs text-foreground break-all border border-border/60 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-sans">
            <span className="font-semibold uppercase tracking-wider">
              {signature
                ? "Immutable Signed Digest (SHA-256):"
                : "Current Content Digest (SHA-256):"}
            </span>
            {signature && status === "SIGNED" && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Exact Hash Match
              </span>
            )}
            {status === "INVALID" && (
              <span className="text-destructive font-bold flex items-center gap-1">
                <XCircle className="size-3" /> Hash Divergence Detected
              </span>
            )}
          </div>
          <div
            className={cn(
              status === "INVALID" ? "text-destructive font-bold" : "text-foreground font-medium",
            )}
          >
            [{signature?.signed_content_hash || contentHash}]
          </div>
          {status === "INVALID" && signature && (
            <div className="border-t border-border/40 pt-1 text-[11px] text-muted-foreground font-sans">
              <span className="text-destructive font-bold block">
                Current File Hash: {contentHash}
              </span>
              <span className="text-muted-foreground">
                Original Signed Hash: {signature.signed_content_hash}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Provider Metadata & Regulatory Disclaimer Banner */}
      <div className="rounded-lg bg-muted/30 p-3.5 border border-border/60 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-foreground">
            Algorithm:{" "}
            <span className="font-mono text-muted-foreground">
              {signature?.signature_algorithm || "ECDSA-P256-SHA256"}
            </span>
          </span>
          <span className="font-semibold text-foreground">
            Reference:{" "}
            <span className="font-mono text-muted-foreground">
              {signature?.signature_reference || "PENDING"}
            </span>
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/40 pt-2 space-y-1">
          <p>
            <strong>Prototype Architecture Disclosure:</strong> This electronic approval workflow
            operates on the internal platform cryptographic keystore under Bharatiya Sakshya
            Adhiniyam (BSA), 2023 §63.
          </p>
          <p className="text-[10px] opacity-85">
            <strong>DSC Readiness:</strong> The signature metadata architecture is designed to
            integrate directly with Indian Controller of Certifying Authorities (CCA) Class 3 DSC
            hardware tokens and NIC eSign Gateway APIs.{" "}
            <em>
              This system does not claim to be a government-certified DSC until such external
              hardware token integration is completed.
            </em>
          </p>
        </div>
      </div>
    </div>
  );
}

function DocumentDetailPage() {
  const { documentId } = Route.useParams();
  const queryClient = useQueryClient();
  const detailQuery = useQuery(secureDocumentDetailQuery(documentId));
  const staff = useCurrentStaff();
  const staffName = staff.data?.fullName || "Registry Staff";
  const staffRole = staff.data?.role || "police_officer";
  const permissions = usePermissions();

  const [activeTab, setActiveTab] = useState("preview");

  // Tamper Simulation Confirmation State
  const [isTamperConfirmOpen, setIsTamperConfirmOpen] = useState(false);
  const [targetTamperVersion, setTargetTamperVersion] = useState<number | null>(null);

  // Version Viewing / Sandbox Selection State
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);

  // Version Upload Dialog State
  const [isNewVersionOpen, setIsNewVersionOpen] = useState(false);
  const [versionFileName, setVersionFileName] = useState("");
  const [versionMimeType, setVersionMimeType] = useState("application/pdf");
  const [versionSizeBytes, setVersionSizeBytes] = useState<number>(0);
  const [versionChangeSummary, setVersionChangeSummary] = useState("");
  const [versionContentText, setVersionContentText] = useState("");

  // Compare Versions Dialog State
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareVersionA, setCompareVersionA] = useState<number>(1);
  const [compareVersionB, setCompareVersionB] = useState<number>(1);
  const [compareDiffFilter, setCompareDiffFilter] = useState<"all" | "changes_only">("all");

  // Integrity Verification State
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<DocumentIntegrityResult | null>(null);

  // Digital Signature / Approval State
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
  const [targetSignVersion, setTargetSignVersion] = useState<number | null>(null);
  const [signerCustomName, setSignerCustomName] = useState("");
  const [signerCustomRole, setSignerCustomRole] = useState("");
  const [signaturePurpose, setSignaturePurpose] = useState("");
  const [signatureAcknowledged, setSignatureAcknowledged] = useState(false);

  const signaturesQuery = useQuery({
    queryKey: ["secure-document-signatures", documentId],
    queryFn: async () => {
      return getAllDigitalSignatures().filter(
        (s) => s.entity_type === "DOCUMENT_VERSION" && s.entity_id === documentId,
      );
    },
  });
  const docSignatures = signaturesQuery.data || [];

  const signDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!detailQuery.data?.document) return;
      const doc = detailQuery.data.document;
      const verNum = targetSignVersion ?? (selectedVersionNumber || doc.current_version);
      const verRecord = detailQuery.data.versions.find((v) => v.version_number === verNum);
      const contentHash = verRecord?.sha256_hash || doc.latest_sha256;

      return signDocumentVersion({
        documentId: doc.id,
        documentNumber: doc.document_number,
        versionNumber: verNum,
        signerUser: signerCustomName.trim() || staffName,
        signerRole: signerCustomRole.trim() || staffRole,
        contentHash,
        purpose:
          signaturePurpose.trim() ||
          `Official Electronic Endorsement & Approval for ${doc.document_number} (Version v${verNum})`,
      });
    },
    onSuccess: (sig) => {
      if (sig) {
        toast.success(
          `Digital Signature / Approval committed for version v${sig.version_number}. Reference: ${sig.signature_reference}`,
        );
      }
      setIsSignDialogOpen(false);
      setSignaturePurpose("");
      setSignatureAcknowledged(false);
      queryClient.invalidateQueries({ queryKey: ["secure-document-signatures", documentId] });
      queryClient.invalidateQueries({ queryKey: ["secure-document-detail", documentId] });
      queryClient.invalidateQueries({ queryKey: ["secure-documents"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to commit digital signature."),
  });

  const openSignModal = (versionNum?: number) => {
    const target =
      versionNum ?? (selectedVersionNumber || detailQuery.data?.document?.current_version || 1);
    setTargetSignVersion(target);
    setSignerCustomName(staffName);
    setSignerCustomRole(staffRole);
    setSignaturePurpose(
      `Official Electronic Endorsement & Approval for ${detailQuery.data?.document?.document_number || "Document"} (Version v${target})`,
    );
    setSignatureAcknowledged(false);
    setIsSignDialogOpen(true);
  };

  const newVersionMutation = useMutation({
    mutationFn: async () => {
      if (!detailQuery.data?.document) return;
      if (!versionFileName.trim()) throw new Error("File attachment name is required.");
      if (!versionChangeSummary.trim() || versionChangeSummary.trim().length < 5) {
        throw new Error("Change summary must be at least 5 characters explaining legal reasoning.");
      }

      return createNewDocumentVersion({
        documentId: detailQuery.data.document.id,
        fileName: versionFileName.trim(),
        mimeType: versionMimeType,
        fileSizeBytes:
          versionSizeBytes > 0
            ? versionSizeBytes
            : Math.floor(detailQuery.data.document.file_size_bytes * 1.08),
        changeSummary: versionChangeSummary.trim(),
        contentText: versionContentText.trim() || undefined,
        uploadedByName: staffName,
        uploadedByRole: staffRole,
      });
    },
    onSuccess: (updatedDoc) => {
      if (updatedDoc) {
        toast.success(
          `Version v${updatedDoc.current_version} permanently sealed into immutable version tree.`,
        );
        setSelectedVersionNumber(updatedDoc.current_version);
      }
      setIsNewVersionOpen(false);
      setVersionFileName("");
      setVersionChangeSummary("");
      setVersionContentText("");
      queryClient.invalidateQueries({ queryKey: ["secure-document-detail", documentId] });
      queryClient.invalidateQueries({ queryKey: ["secure-documents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const runVerification = async (targetVer?: number) => {
    if (!detailQuery.data?.document) return;
    const doc = detailQuery.data.document;
    const verNum = targetVer ?? (selectedVersionNumber || doc.current_version);
    setIsVerifying(true);
    try {
      const result = await verifyDocumentVersionIntegrity({
        documentId: doc.id,
        versionNumber: verNum,
        verifierName: staffName,
        verifierRole: staffRole,
      });
      setIntegrityResult(result);
      setIsVerifyOpen(true);
      queryClient.invalidateQueries({ queryKey: ["secure-document-detail", documentId] });
      queryClient.invalidateQueries({ queryKey: ["secure-documents"] });

      if (result.status === "VERIFIED") {
        toast.success(`Integrity verified for v${verNum}: SHA-256 matches recorded deposit hash.`);
      } else if (result.status === "INTEGRITY_MISMATCH") {
        toast.error(
          `SECURITY ALERT: Integrity mismatch detected for v${verNum}! High-priority alert dispatched.`,
        );
      } else {
        toast.warning(`Verification warning for v${verNum}: Storage payload unavailable.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to execute integrity verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTamperSimulation = (verNum: number) => {
    if (!detailQuery.data?.document) return;
    const res = simulateDocumentTamper(detailQuery.data.document.id, verNum);
    if (res.success) {
      toast.warning(
        "Simulated file alteration injected! Now running verification to test detection...",
      );
      queryClient.invalidateQueries({ queryKey: ["secure-document-detail", documentId] });
      runVerification(verNum);
    }
  };

  const handleRestoreAuthentic = (verNum: number) => {
    if (!detailQuery.data?.document) return;
    const res = restoreDocumentContent(detailQuery.data.document.id, verNum);
    if (res.success) {
      toast.success("Authentic file content restored! Now re-verifying...");
      queryClient.invalidateQueries({ queryKey: ["secure-document-detail", documentId] });
      runVerification(verNum);
    }
  };

  const handleDownloadVersion = async (ver: DocumentVersionRecord) => {
    if (!detailQuery.data?.document) return;
    const doc = detailQuery.data.document;

    // 1. Record access log for zero silent leaks
    await recordDocumentAccess({
      documentId: doc.id,
      documentNumber: doc.document_number,
      accessType: "DOWNLOAD",
      userName: staffName,
      userRole: staffRole,
    });

    // 2. Generate simulated secure blob download with cryptographic manifest
    const content = ver.content_text
      ? `${doc.title} — Version v${ver.version_number}\nDocument Number: ${doc.document_number}\nVersion: v${ver.version_number}\nFile Reference: ${ver.file_reference}\nUploaded By: ${ver.uploaded_by_name} (${ver.uploaded_by_role})\nTimestamp: ${ver.created_at}\nMIME Type: ${ver.mime_type}\nSHA-256 Digest: ${ver.sha256_hash}\nDigital Signature: ${ver.digital_signature || "N/A"}\n\nOperative Content:\n${ver.content_text}`
      : `NyayaSetu Certified Legal Document Record\n${doc.title} — Version v${ver.version_number}\nRef: ${doc.document_number}\nFile Reference: ${ver.file_reference}\nSHA-256: ${ver.sha256_hash}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `v${ver.version_number}_${ver.file_name.endsWith(".pdf") ? ver.file_name.replace(".pdf", ".txt") : ver.file_name + ".txt"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(
      `Secure copy of v${ver.version_number} (${ver.file_name}) downloaded with verified SHA-256 digest.`,
    );
  };

  const openUploadModal = () => {
    if (!detailQuery.data?.document) return;
    const doc = detailQuery.data.document;
    const baseName = doc.file_name.replace(/\.[^/.]+$/, "");
    const ext = doc.file_name.includes(".") ? doc.file_name.split(".").pop() : "pdf";
    setVersionFileName(`${baseName}_v${doc.current_version + 1}.${ext}`);
    setVersionMimeType("application/pdf");
    setVersionSizeBytes(Math.floor(doc.file_size_bytes * 1.06));
    setVersionChangeSummary("");
    setVersionContentText(doc.content_text || "");
    setIsNewVersionOpen(true);
  };

  const openCompareModal = (baseVer?: number, targetVer?: number) => {
    if (!detailQuery.data?.document) return;
    const doc = detailQuery.data.document;
    const versions = detailQuery.data.versions;
    if (versions.length === 0) return;

    if (baseVer !== undefined && targetVer !== undefined) {
      setCompareVersionA(baseVer);
      setCompareVersionB(targetVer);
    } else if (versions.length > 1) {
      setCompareVersionA(versions[0]?.version_number ?? 1);
      setCompareVersionB(doc.current_version);
    } else {
      setCompareVersionA(doc.current_version);
      setCompareVersionB(doc.current_version);
    }
    setIsCompareOpen(true);
  };

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data?.document) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 space-y-4">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground mb-2">
          <Link to="/documents">
            <ArrowLeft className="size-4" />
            Back to Document Repository
          </Link>
        </Button>
        <ErrorState
          title="Document Not Found or Access Restricted"
          error={
            detailQuery.error ||
            `The requested document ID "${documentId}" could not be located in the central vault, or your role lacks clearance.`
          }
          onRetry={() => detailQuery.refetch()}
        />
      </div>
    );
  }

  const { document: doc, versions, integrity, accessLogs } = detailQuery.data;

  const isAuthorized = canAccessDocumentRecord(staffRole, doc, staff.data?.judgeId);

  if (!isAuthorized) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <Lock className="size-7" />
        </div>
        <Badge variant="destructive" className="mb-3 text-xs uppercase tracking-wider">
          Security Clearance Violation — 403 Forbidden
        </Badge>
        <h2 className="text-xl font-bold text-foreground">
          Access Denied: {doc.sensitivity_tier} Clearance Required
        </h2>
        <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
          Your current authenticated role (<strong className="text-foreground">{staffRole}</strong>)
          lacks statutory security clearance to inspect this legal record. All unauthorized
          inspection attempts are logged to the tamper-evident audit trail under Section 63 BSA
          2023.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link to="/documents">Back to Document Repository</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Resolved active version for viewing/sandbox preview
  const currentVerRecord = versions.find((v) => v.version_number === doc.current_version) ||
    versions[versions.length - 1] || {
      id: `ver-${doc.id}-${doc.current_version}`,
      document_id: doc.id,
      version_number: doc.current_version,
      file_name: doc.file_name,
      file_size_bytes: doc.file_size_bytes,
      file_reference: `sec-vault://documents/${doc.file_name}`,
      mime_type: "application/pdf",
      storage_path: doc.storage_path,
      sha256_hash: doc.latest_sha256,
      uploaded_by_name: doc.uploaded_by_name,
      uploaded_by_role: doc.uploaded_by_role,
      change_summary: "Original document registration & official digital deposit",
      digital_signature: `ECDSA_P256_SHA256_0x${doc.latest_sha256.slice(0, 48)}`,
      signer_identity: `${doc.originating_agency} / Digital Verification Authority`,
      integrity_status: "VERIFIED",
      content_text: doc.content_text,
      created_at: doc.created_at,
    };

  const activeVersion: DocumentVersionRecord =
    selectedVersionNumber !== null
      ? versions.find((v) => v.version_number === selectedVersionNumber) || currentVerRecord
      : currentVerRecord;

  const isViewingHistorical = activeVersion.version_number !== doc.current_version;

  // Comparison report calculation
  const verA =
    versions.find((v) => v.version_number === compareVersionA) || versions[0] || currentVerRecord;
  const verB = versions.find((v) => v.version_number === compareVersionB) || currentVerRecord;
  const comparisonReport: VersionComparisonReport | null =
    verA && verB ? compareDocumentVersions(verA, verB) : null;

  // Resolve active version digital signature & status (strictly bound to activeVersion.version_number)
  const activeSignature = docSignatures.find(
    (s) => s.version_number === activeVersion.version_number,
  );

  const isTamperedActiveVersion =
    doc.is_tampered || activeVersion.integrity_status === "INTEGRITY_MISMATCH";

  const activeSignatureStatus: SignatureStatus = !activeSignature
    ? "PENDING"
    : isTamperedActiveVersion ||
        (activeSignature.signed_content_hash &&
          activeSignature.signed_content_hash.toLowerCase() !==
            activeVersion.sha256_hash.toLowerCase())
      ? "INVALID"
      : activeSignature.signature_status === "INVALID"
        ? "INVALID"
        : "SIGNED";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back Link */}
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-xs">
        <Link to="/documents">
          <ArrowLeft className="size-3.5 mr-1" /> All Documents
        </Link>
      </Button>

      {/* Hero Header Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                {doc.document_number}
              </span>
              <span className="text-xs text-muted-foreground font-medium">•</span>
              <Badge variant="outline" className="text-xs">
                {doc.category}
              </Badge>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-mono text-xs">
                Current: v{doc.current_version}
              </Badge>
              {versions.length > 1 && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {versions.length} versions sealed
                </Badge>
              )}
              {doc.is_tampered && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="size-3" /> Integrity Failed
                </Badge>
              )}
              {activeSignatureStatus === "SIGNED" ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs gap-1 font-sans">
                  <CheckCircle2 className="size-3" /> Digitally Signed (v
                  {activeVersion.version_number})
                </Badge>
              ) : activeSignatureStatus === "INVALID" ? (
                <Badge variant="destructive" className="text-xs gap-1">
                  <XCircle className="size-3" /> Signature Invalid
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs gap-1 font-sans"
                >
                  <Clock className="size-3" /> Signature Pending (v{activeVersion.version_number})
                </Badge>
              )}
              {doc.sensitivity_tier === "SEALED_COVER_IN_CAMERA" ? (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <Lock className="size-3" /> Sealed Cover
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-xs text-blue-700 dark:text-blue-400 border-blue-500/30"
                >
                  {doc.sensitivity_tier}
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-xl font-bold text-foreground sm:text-2xl">{doc.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
              <span>{doc.originating_agency}</span>
              <span>•</span>
              <span>{doc.police_station}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {permissions.canSignDocuments && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSignModal(activeVersion.version_number)}
                className="gap-1.5 text-xs text-primary border-primary/40 bg-primary/5 hover:bg-primary/15"
              >
                <FileCheck2 className="size-3.5" />
                Digital Signature / Approval
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => runVerification(activeVersion.version_number)}
              disabled={isVerifying}
              className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/15"
            >
              {isVerifying ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="size-3.5" />
              )}
              Verify Integrity
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => openCompareModal()}
              className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
            >
              <Split className="size-3.5" />
              Compare / View Version History
            </Button>

            {permissions.canDownloadDocuments && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadVersion(currentVerRecord)}
                className="gap-1.5 text-xs"
              >
                <Download className="size-3.5" />
                Download Current (v{doc.current_version})
              </Button>
            )}

            {permissions.canVersionDocuments && (
              <Button size="sm" onClick={openUploadModal} className="gap-1.5 text-xs">
                <FilePlus className="size-3.5" />
                Upload New Version
              </Button>
            )}
          </div>
        </div>

        {/* Association Quick Badges */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/80 pt-4 text-xs">
          {doc.case_number && (
            <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded border border-border/60">
              <Gavel className="size-3.5 text-primary" />
              <span className="text-muted-foreground">Case:</span>
              <Link
                to="/cases/$caseId"
                params={{ caseId: doc.case_id || "demo-case" }}
                className="font-medium text-foreground hover:underline flex items-center gap-1"
              >
                {doc.case_number}
                <ExternalLink className="size-2.5" />
              </Link>
            </div>
          )}

          {doc.asset_code && (
            <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded border border-border/60">
              <Tag className="size-3.5 text-amber-600" />
              <span className="text-muted-foreground">Evidence Exhibit:</span>
              <Link
                to="/assets/$assetId"
                params={{ assetId: doc.asset_id || "ast_ev_01" }}
                className="font-medium text-foreground hover:underline flex items-center gap-1 font-mono"
              >
                {doc.asset_code}
                <ExternalLink className="size-2.5" />
              </Link>
            </div>
          )}

          {doc.fir_number && (
            <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded border border-border/60">
              <span className="text-muted-foreground">FIR:</span>
              <strong className="text-foreground">{doc.fir_number}</strong>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded border border-border/60">
            <span className="text-muted-foreground">Uploaded by:</span>
            <strong className="text-foreground">{doc.uploaded_by_name}</strong>
          </div>

          <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded border border-border/60">
            <span className="text-muted-foreground">Registered:</span>
            <span className="text-foreground">
              {new Date(doc.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded border border-border/60 font-mono">
            <span className="text-muted-foreground">Vault SHA-256:</span>
            <span className="text-foreground">{doc.latest_sha256.slice(0, 12)}...</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8 space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto p-1 bg-muted/60">
          <TabsTrigger value="preview" className="text-xs py-2">
            Document Preview {isViewingHistorical ? `(v${activeVersion.version_number})` : ""}
          </TabsTrigger>
          <TabsTrigger value="particulars" className="text-xs py-2">
            Particulars & Metadata
          </TabsTrigger>
          <TabsTrigger value="versions" className="text-xs py-2">
            Versions Tree ({versions.length})
          </TabsTrigger>
          <TabsTrigger value="integrity" className="text-xs py-2">
            Integrity & §63 BSA
          </TabsTrigger>
          <TabsTrigger value="access" className="text-xs py-2">
            Access Logs ({accessLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. DOCUMENT PREVIEW TAB */}
        <TabsContent value="preview" className="space-y-4">
          {/* Archived Version Notice Banner */}
          {isViewingHistorical && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2.5 text-xs">
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">
                    Viewing Archived Historical Version: v{activeVersion.version_number}
                  </p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    Uploaded by <strong>{activeVersion.uploaded_by_name}</strong> (
                    {activeVersion.uploaded_by_role}) on{" "}
                    {new Date(activeVersion.created_at).toLocaleString("en-IN")}. This is an
                    immutable past snapshot.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-500/40 bg-background/50 hover:bg-amber-500/20"
                  onClick={() =>
                    openCompareModal(activeVersion.version_number, doc.current_version)
                  }
                >
                  <Split className="size-3 mr-1" />
                  Compare with Current (v{doc.current_version})
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => setSelectedVersionNumber(doc.current_version)}
                >
                  Switch to Current (v{doc.current_version})
                </Button>
              </div>
            </div>
          )}

          <Card className="shadow-xs border-border/80">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/60">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="size-4 text-primary" />
                  Authenticated Document Viewer
                  {activeVersion.version_number === doc.current_version ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                      CURRENT ACTIVE VERSION
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]"
                    >
                      ARCHIVED SNAPSHOT v{activeVersion.version_number}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Rendered in secure sandbox. Current session for {staffName} ({staffRole}).
                </CardDescription>
              </div>

              {/* Version Switcher Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Label
                    htmlFor="version-selector"
                    className="text-xs text-muted-foreground font-medium"
                  >
                    Version:
                  </Label>
                  <Select
                    value={String(activeVersion.version_number)}
                    onValueChange={(val) => setSelectedVersionNumber(Number(val))}
                  >
                    <SelectTrigger
                      id="version-selector"
                      className="h-8 text-xs w-[170px] bg-background"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem key={v.id} value={String(v.version_number)} className="text-xs">
                          v{v.version_number}{" "}
                          {v.version_number === doc.current_version
                            ? "(Current Active)"
                            : "(Archived)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Badge variant="outline" className="font-mono text-xs hidden md:inline-flex">
                  {activeVersion.mime_type || doc.file_format} •{" "}
                  {(activeVersion.file_size_bytes / 1024).toFixed(0)} KB
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runVerification(activeVersion.version_number)}
                  disabled={isVerifying}
                  className="text-xs h-8 gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  {isVerifying ? (
                    <RefreshCw className="size-3 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-3" />
                  )}
                  Verify v{activeVersion.version_number}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadVersion(activeVersion)}
                  className="text-xs h-8 gap-1"
                >
                  <Download className="size-3" /> Download
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {activeVersion.content_text ? (
                <div className="rounded-lg border border-border bg-muted/20 p-6 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-[550px] overflow-y-auto">
                  {activeVersion.content_text}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
                  <FileText className="mx-auto size-12 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    {activeVersion.file_name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                    This file version is stored in encrypted vault storage (
                    {activeVersion.storage_path}). Click below to download and inspect.
                  </p>
                  <Button
                    onClick={() => handleDownloadVersion(activeVersion)}
                    className="mt-4 gap-1.5 text-xs"
                    size="sm"
                  >
                    <Download className="size-3.5" />
                    Download Version v{activeVersion.version_number} (
                    {(activeVersion.file_size_bytes / 1024).toFixed(0)} KB)
                  </Button>
                </div>
              )}

              {/* Version Cryptographic Manifest Strip */}
              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-muted-foreground font-mono bg-muted/30 p-3 rounded border border-border/60">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      Version v{activeVersion.version_number}
                    </span>
                    <span>•</span>
                    <span className="text-muted-foreground">
                      SHA-256: {activeVersion.sha256_hash}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Vault Ref: {activeVersion.file_reference} • Signer:{" "}
                    {activeVersion.signer_identity || doc.originating_agency}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {activeVersion.integrity_status === "INTEGRITY_MISMATCH" || doc.is_tampered ? (
                    <span className="text-destructive flex items-center gap-1 font-bold text-xs">
                      <XCircle className="size-3.5" /> INTEGRITY MISMATCH
                    </span>
                  ) : (
                    <span className="text-emerald-600 flex items-center gap-1 font-semibold text-xs">
                      <CheckCircle2 className="size-3.5" />{" "}
                      {activeVersion.integrity_status || "VERIFIED"} (BSA §63)
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Digital Signature / Approval Status Card (Strictly bound to active version) */}
          <DigitalSignatureStatusCard
            status={activeSignatureStatus}
            signature={activeSignature}
            versionNumber={activeVersion.version_number}
            contentHash={activeVersion.sha256_hash}
            onOpenSignModal={() => openSignModal(activeVersion.version_number)}
            isHistorical={isViewingHistorical}
            canSign={permissions.canSignDocuments}
          />
        </TabsContent>

        {/* 2. PARTICULARS & METADATA TAB */}
        <TabsContent value="particulars" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="shadow-xs border-border/80">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileCode className="size-4 text-primary" />
                  Filing Identifiers & Registry Particulars
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <FieldItem label="Official Document Number" value={doc.document_number} />
                <FieldItem label="Legal Title" value={doc.title} />
                <FieldItem label="Document Classification" value={doc.category} />
                <FieldItem label="Originating Police Station" value={doc.police_station} />
                <FieldItem label="Investigating Agency" value={doc.originating_agency} />
                <FieldItem label="Sensitivity / Security Clearance" value={doc.sensitivity_tier} />
              </CardContent>
            </Card>

            <Card className="shadow-xs border-border/80">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="size-4 text-primary" />
                  Case Association & Digital Custody
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <FieldItem label="Attached Judicial Case" value={doc.case_number || "None"} />
                <FieldItem label="Attached Evidence Exhibit" value={doc.asset_code || "None"} />
                <FieldItem label="Storage Path" value={doc.storage_path} />
                <FieldItem label="File Name" value={doc.file_name} />
                <FieldItem
                  label="File Size"
                  value={`${(doc.file_size_bytes / 1024).toFixed(1)} KB`}
                />
                <FieldItem
                  label="Uploaded At"
                  value={new Date(doc.created_at).toLocaleString("en-IN")}
                />
                <FieldItem
                  label="Last Modified"
                  value={new Date(doc.updated_at).toLocaleString("en-IN")}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 3. VERSIONS HISTORY TAB */}
        <TabsContent value="versions" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/60">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <History className="size-4 text-primary" />
                  Immutable Document Version Control Tree
                </CardTitle>
                <CardDescription className="text-xs">
                  Every revision preserves previous history non-destructively and seals a new
                  cryptographic block.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openCompareModal()}
                  className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
                >
                  <Split className="size-3.5" />
                  Compare / View Version History
                </Button>
                {permissions.canVersionDocuments && (
                  <Button size="sm" onClick={openUploadModal} className="gap-1.5 text-xs">
                    <Plus className="size-3.5" />
                    Upload Revision
                  </Button>
                )}
              </div>
            </CardHeader>

            {/* Quick Stat Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/20 border-b border-border/60 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Active Version
                </span>
                <p className="font-mono font-bold text-foreground text-sm flex items-center gap-1.5">
                  v{doc.current_version}
                  <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Total Sealed Versions
                </span>
                <p className="font-mono font-bold text-foreground text-sm">{versions.length}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Genesis Filing (v1)
                </span>
                <p className="text-foreground">
                  {new Date(versions[0]?.created_at || doc.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Integrity Standard
                </span>
                <p className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> BSA 2023 §63 Sealed
                </p>
              </div>
            </div>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[110px]">Version</TableHead>
                    <TableHead>File & Reference</TableHead>
                    <TableHead>MIME & Size</TableHead>
                    <TableHead>Change Summary & Legal Rationale</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Integrity & Hash</TableHead>
                    <TableHead>Digital Signature / Approval</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((ver) => {
                    const isCurrent = ver.version_number === doc.current_version;
                    const isMismatch = ver.integrity_status === "INTEGRITY_MISMATCH";
                    const vSig = docSignatures.find((s) => s.version_number === ver.version_number);
                    const isVerTampered = ver.integrity_status === "INTEGRITY_MISMATCH";
                    const vStatus: SignatureStatus = !vSig
                      ? "PENDING"
                      : isVerTampered ||
                          vSig.signed_content_hash.toLowerCase() !== ver.sha256_hash.toLowerCase()
                        ? "INVALID"
                        : vSig.signature_status;

                    return (
                      <TableRow
                        key={ver.id}
                        className={cn(
                          isCurrent && "bg-emerald-500/[0.03]",
                          isMismatch && "bg-destructive/[0.05]",
                        )}
                      >
                        <TableCell>
                          {isCurrent ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-mono text-xs font-semibold whitespace-nowrap">
                              v{ver.version_number} (Current)
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground font-mono text-xs whitespace-nowrap"
                            >
                              v{ver.version_number} (Archived)
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="max-w-[200px]">
                          <div className="font-medium text-xs text-foreground truncate">
                            {ver.file_name}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                            {ver.file_reference}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <span className="font-mono">{ver.mime_type || "application/pdf"}</span>
                          <span className="block text-[11px] text-foreground">
                            {(ver.file_size_bytes / 1024).toFixed(1)} KB
                          </span>
                        </TableCell>

                        <TableCell className="text-xs text-foreground max-w-xs">
                          <p className="line-clamp-2">{ver.change_summary}</p>
                        </TableCell>

                        <TableCell className="text-xs whitespace-nowrap">
                          <span className="font-medium text-foreground">
                            {ver.uploaded_by_name}
                          </span>
                          <span className="block text-[10px] text-muted-foreground capitalize">
                            {ver.uploaded_by_role}
                          </span>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(ver.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          {isMismatch ? (
                            <div className="flex items-center gap-1 text-[11px] text-destructive font-bold">
                              <XCircle className="size-3" />
                              <span>MISMATCH</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                              <CheckCircle2 className="size-3" />
                              <span>{ver.integrity_status || "VERIFIED"}</span>
                            </div>
                          )}
                          <span className="font-mono text-[10px] text-muted-foreground truncate block max-w-[120px]">
                            {ver.sha256_hash.slice(0, 16)}...
                          </span>
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          {vStatus === "SIGNED" ? (
                            <div>
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
                                <CheckCircle2 className="size-3" /> SIGNED
                              </Badge>
                              <span className="text-[10px] text-muted-foreground block truncate max-w-[130px] mt-0.5">
                                {vSig?.signer_user}
                              </span>
                            </div>
                          ) : vStatus === "INVALID" ? (
                            <div>
                              <Badge
                                variant="destructive"
                                className="text-[10px] font-bold flex items-center gap-1 w-fit"
                              >
                                <XCircle className="size-3" /> INVALID
                              </Badge>
                              <span className="text-[10px] text-destructive block mt-0.5">
                                Hash Divergence
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold flex items-center gap-1"
                              >
                                <Clock className="size-2.5" /> PENDING
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] text-primary"
                                onClick={() => openSignModal(ver.version_number)}
                              >
                                Sign
                              </Button>
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs text-primary border-primary/30 gap-1"
                              onClick={() => openSignModal(ver.version_number)}
                            >
                              <FileCheck2 className="size-3" />
                              {vStatus === "SIGNED" ? "Re-Sign" : "Sign"}
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1"
                              onClick={() => runVerification(ver.version_number)}
                              disabled={isVerifying}
                            >
                              <ShieldCheck className="size-3" />
                              Verify
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-primary gap-1"
                              onClick={() => {
                                setSelectedVersionNumber(ver.version_number);
                                setActiveTab("preview");
                              }}
                            >
                              <Eye className="size-3" />
                              View
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-foreground gap-1"
                              onClick={() =>
                                openCompareModal(ver.version_number, doc.current_version)
                              }
                            >
                              <Split className="size-3" />
                              Compare
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground gap-1"
                              onClick={() => handleDownloadVersion(ver)}
                            >
                              <Download className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. INTEGRITY & BSA 2023 SEC 63 TAB */}
        <TabsContent value="integrity" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/60">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  Cryptographic Integrity & BSA 2023 Section 63 Admissibility
                </CardTitle>
                <CardDescription className="text-xs">
                  Electronic record authenticity certificate compliant with Indian Evidence Law.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => runVerification(selectedVersionNumber || doc.current_version)}
                  disabled={isVerifying}
                  className="gap-1.5 text-xs"
                >
                  {isVerifying ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-3.5" />
                  )}
                  Execute Real-Time Verification
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Display either the latest live result or the loaded integrity record */}
              <IntegrityStatusCard
                result={
                  integrityResult || {
                    status: doc.is_tampered ? "INTEGRITY_MISMATCH" : "VERIFIED",
                    documentId: doc.id,
                    documentNumber: doc.document_number,
                    versionNumber: selectedVersionNumber || doc.current_version,
                    fileName: activeVersion.file_name,
                    fileReference: activeVersion.file_reference,
                    recordedSha256: activeVersion.sha256_hash,
                    computedSha256: activeVersion.sha256_hash,
                    match: !doc.is_tampered,
                    verifiedAt: integrity.last_verified_at,
                    verifiedByName: staffName,
                    verifiedByRole: staffRole,
                    message: doc.is_tampered
                      ? "CRITICAL INTEGRITY FAILURE: File content differs from recorded deposit hash."
                      : "Cryptographic SHA-256 checksum matches the recorded deposit hash.",
                    bsaSection63Clause: integrity.bsa_compliance_clause,
                    ledgerAnchor: integrity.ledger_anchor,
                  }
                }
                onTamper={() => {
                  setTargetTamperVersion(selectedVersionNumber || doc.current_version);
                  setIsTamperConfirmOpen(true);
                }}
                onRestore={() =>
                  handleRestoreAuthentic(selectedVersionNumber || doc.current_version)
                }
                onReverify={() => runVerification(selectedVersionNumber || doc.current_version)}
                isVerifying={isVerifying}
              />

              {/* Associated Digital Signature / Approval Status */}
              <div className="pt-4 border-t border-border/60">
                <DigitalSignatureStatusCard
                  status={activeSignatureStatus}
                  signature={activeSignature}
                  versionNumber={activeVersion.version_number}
                  contentHash={activeVersion.sha256_hash}
                  onOpenSignModal={() => openSignModal(activeVersion.version_number)}
                  isHistorical={isViewingHistorical}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. ACCESS LOGS TAB */}
        <TabsContent value="access" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="size-4 text-primary" />
                Document Access & Inspection History
              </CardTitle>
              <CardDescription className="text-xs">
                Zero silent leaks policy: All previews, downloads, and verifications are logged with
                authenticated identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>User / Official</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Access Type</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Terminal / IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-medium text-foreground">
                        {log.user_name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.user_role}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {log.access_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {log.ip_or_terminal}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* DIALOG 1: COMPARE / VIEW VERSION HISTORY MODAL */}
      {/* ========================================================================= */}
      <Dialog open={isCompareOpen} onOpenChange={setIsCompareOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Split className="size-5 text-primary" />
              Compare / View Version History
            </DialogTitle>
            <DialogDescription className="text-xs">
              Side-by-side comparative inspection and legal text diff between immutable filings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Version Selectors Bar */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="compareVerA"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Base Version (A)
                  </Label>
                  <Select
                    value={String(compareVersionA)}
                    onValueChange={(val) => setCompareVersionA(Number(val))}
                  >
                    <SelectTrigger id="compareVerA" className="text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem key={v.id} value={String(v.version_number)} className="text-xs">
                          v{v.version_number} — {v.file_name}{" "}
                          {v.version_number === doc.current_version ? "(Current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="compareVerB"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Comparison Target (B)
                  </Label>
                  <Select
                    value={String(compareVersionB)}
                    onValueChange={(val) => setCompareVersionB(Number(val))}
                  >
                    <SelectTrigger id="compareVerB" className="text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem key={v.id} value={String(v.version_number)} className="text-xs">
                          v{v.version_number} — {v.file_name}{" "}
                          {v.version_number === doc.current_version ? "(Current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quick Shortcuts */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs">
                <span className="text-[11px] text-muted-foreground">Quick Comparisons:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => {
                      setCompareVersionA(1);
                      setCompareVersionB(doc.current_version);
                    }}
                  >
                    v1 (Genesis) vs v{doc.current_version} (Current)
                  </Button>
                  {doc.current_version > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] px-2"
                      onClick={() => {
                        setCompareVersionA(doc.current_version - 1);
                        setCompareVersionB(doc.current_version);
                      }}
                    >
                      v{doc.current_version - 1} vs v{doc.current_version}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Comparison Details Grid */}
            {comparisonReport ? (
              <div className="space-y-5">
                {/* Metadata Side-by-Side Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Card A */}
                  <div className="rounded-lg border border-border/80 bg-card p-4 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Badge variant="outline" className="font-mono text-xs">
                          Version v{comparisonReport.versionA.version_number}
                        </Badge>
                        {comparisonReport.versionA.version_number === doc.current_version && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]">
                            CURRENT
                          </Badge>
                        )}
                      </span>
                      <span className="text-muted-foreground text-[11px]">Base Reference</span>
                    </div>

                    <div className="space-y-1.5 text-muted-foreground">
                      <p>
                        <strong className="text-foreground">File:</strong>{" "}
                        {comparisonReport.versionA.file_name}
                      </p>
                      <p>
                        <strong className="text-foreground">Size:</strong>{" "}
                        {(comparisonReport.versionA.file_size_bytes / 1024).toFixed(1)} KB (
                        {comparisonReport.versionA.mime_type || "application/pdf"})
                      </p>
                      <p>
                        <strong className="text-foreground">Uploader:</strong>{" "}
                        {comparisonReport.versionA.uploaded_by_name} (
                        {comparisonReport.versionA.uploaded_by_role})
                      </p>
                      <p>
                        <strong className="text-foreground">Timestamp:</strong>{" "}
                        {new Date(comparisonReport.versionA.created_at).toLocaleString("en-IN")}
                      </p>
                      <p className="font-mono text-[10px] truncate">
                        <strong className="text-foreground font-sans">SHA-256:</strong>{" "}
                        {comparisonReport.versionA.sha256_hash}
                      </p>
                    </div>

                    <div className="rounded bg-muted/40 p-2 text-[11px]">
                      <span className="font-semibold text-foreground block">
                        Change Description:
                      </span>
                      <span className="text-muted-foreground">
                        {comparisonReport.versionA.change_summary}
                      </span>
                    </div>
                  </div>

                  {/* Card B */}
                  <div className="rounded-lg border border-border/80 bg-card p-4 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Badge variant="outline" className="font-mono text-xs">
                          Version v{comparisonReport.versionB.version_number}
                        </Badge>
                        {comparisonReport.versionB.version_number === doc.current_version && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]">
                            CURRENT
                          </Badge>
                        )}
                      </span>
                      <span className="text-muted-foreground text-[11px]">Comparison Target</span>
                    </div>

                    <div className="space-y-1.5 text-muted-foreground">
                      <p>
                        <strong className="text-foreground">File:</strong>{" "}
                        {comparisonReport.versionB.file_name}
                      </p>
                      <p className="flex items-center gap-2">
                        <strong className="text-foreground">Size:</strong>{" "}
                        {(comparisonReport.versionB.file_size_bytes / 1024).toFixed(1)} KB
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1 py-0",
                            comparisonReport.sizeDiffBytes >= 0
                              ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                              : "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
                          )}
                        >
                          {comparisonReport.sizeDiffFormatted}
                        </Badge>
                      </p>
                      <p>
                        <strong className="text-foreground">Uploader:</strong>{" "}
                        {comparisonReport.versionB.uploaded_by_name} (
                        {comparisonReport.versionB.uploaded_by_role})
                      </p>
                      <p className="flex items-center gap-1.5">
                        <strong className="text-foreground">Timestamp:</strong>{" "}
                        {new Date(comparisonReport.versionB.created_at).toLocaleString("en-IN")}
                        <span className="text-[10px] text-muted-foreground">
                          ({comparisonReport.timeDiffFormatted} later)
                        </span>
                      </p>
                      <p className="font-mono text-[10px] truncate flex items-center gap-1.5">
                        <strong className="text-foreground font-sans">SHA-256:</strong>{" "}
                        {comparisonReport.versionB.sha256_hash}
                      </p>
                    </div>

                    <div className="rounded bg-muted/40 p-2 text-[11px]">
                      <span className="font-semibold text-foreground block">
                        Change Description:
                      </span>
                      <span className="text-muted-foreground">
                        {comparisonReport.versionB.change_summary}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cryptographic Diff Summary */}
                <div className="rounded-lg border border-border p-3.5 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary shrink-0" />
                    <span>
                      Cryptographic Digest Status:{" "}
                      {comparisonReport.hashMatch ? (
                        <strong className="text-emerald-600">IDENTICAL HASH BLOCKS</strong>
                      ) : (
                        <strong className="text-purple-600 dark:text-purple-400">
                          DISTINCT CRYPTOGRAPHIC BLOCK GENERATED
                        </strong>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>
                      Signer Status:{" "}
                      <strong className="text-foreground">
                        {comparisonReport.versionB.signer_identity || "Verified Official"}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Line-by-Line Operative Text Diff Viewer */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 border-b border-border text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-primary" />
                      <span className="font-semibold text-foreground">
                        Operative Legal Text & Pleading Diff
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        ({comparisonReport.textDiff.filter((l) => l.type === "added").length} added,{" "}
                        {comparisonReport.textDiff.filter((l) => l.type === "removed").length}{" "}
                        removed)
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={compareDiffFilter === "all" ? "secondary" : "ghost"}
                        className="h-6 text-[11px] px-2"
                        onClick={() => setCompareDiffFilter("all")}
                      >
                        All Lines
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={compareDiffFilter === "changes_only" ? "secondary" : "ghost"}
                        className="h-6 text-[11px] px-2"
                        onClick={() => setCompareDiffFilter("changes_only")}
                      >
                        Changes Only
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto bg-muted/10 p-3 font-mono text-[11px] leading-relaxed">
                    {comparisonReport.textDiff.length === 0 ? (
                      <p className="text-center py-6 text-muted-foreground italic">
                        No text diff available (binary files or empty text snapshot).
                      </p>
                    ) : (
                      comparisonReport.textDiff
                        .filter((line) =>
                          compareDiffFilter === "changes_only" ? line.type !== "unchanged" : true,
                        )
                        .map((line, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "px-2 py-0.5 rounded-xs flex items-start gap-2",
                              line.type === "added" &&
                                "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
                              line.type === "removed" &&
                                "bg-red-500/15 text-red-900 dark:text-red-200 line-through opacity-80",
                              line.type === "unchanged" && "text-muted-foreground",
                            )}
                          >
                            <span className="select-none text-[10px] w-5 text-right opacity-50 shrink-0">
                              {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                            </span>
                            <span className="whitespace-pre-wrap break-all">
                              {line.text || " "}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedVersionNumber(compareVersionA);
                setActiveTab("preview");
                setIsCompareOpen(false);
              }}
            >
              View v{compareVersionA} in Viewer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedVersionNumber(compareVersionB);
                setActiveTab("preview");
                setIsCompareOpen(false);
              }}
            >
              View v{compareVersionB} in Viewer
            </Button>
            <Button size="sm" onClick={() => setIsCompareOpen(false)}>
              Close Comparison
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 2: UPLOAD NEW VERSION MODAL (NON-DESTRUCTIVE REVISION) */}
      {/* ========================================================================= */}
      <Dialog open={isNewVersionOpen} onOpenChange={setIsNewVersionOpen}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FilePlus className="size-5 text-primary" />
              Upload Version v{doc.current_version + 1} (Non-Destructive Revision)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Upload an updated filing, supplementary report, or amended pleading. Previous versions
              v1 to v{doc.current_version} remain permanently preserved and tamper-sealed.
            </DialogDescription>
          </DialogHeader>

          {/* Immutable Preservation Guarantee Banner */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-950 dark:text-emerald-100 flex items-start gap-2.5">
            <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Zero Destructive Overwrite Guarantee</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                Existing versions v1 to v{doc.current_version} will never be mutated or replaced.
                Submitting will commit a new cryptographic block pointing to version v
                {doc.current_version + 1}.
              </p>
            </div>
          </div>

          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="vFileName" className="text-xs font-semibold">
                Revision File Attachment Name *
              </Label>
              <Input
                id="vFileName"
                value={versionFileName}
                onChange={(e) => setVersionFileName(e.target.value)}
                placeholder="e.g. Charge_Sheet_Supplementary_CFSL_Ballistics.pdf"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vMime" className="text-xs font-semibold">
                  MIME Content Type *
                </Label>
                <Select value={versionMimeType} onValueChange={setVersionMimeType}>
                  <SelectTrigger id="vMime" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="application/pdf">application/pdf</SelectItem>
                    <SelectItem value="text/plain">text/plain</SelectItem>
                    <SelectItem value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                      application/vnd.docx
                    </SelectItem>
                    <SelectItem value="image/jpeg">image/jpeg</SelectItem>
                    <SelectItem value="image/png">image/png</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vSize" className="text-xs font-semibold">
                  File Size (Bytes / Estimated)
                </Label>
                <Input
                  id="vSize"
                  type="number"
                  value={versionSizeBytes || ""}
                  onChange={(e) => setVersionSizeBytes(Number(e.target.value))}
                  placeholder="e.g. 2450000"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vSummary" className="text-xs font-semibold">
                Change Summary & Legal Rationale *
              </Label>
              <Textarea
                id="vSummary"
                value={versionChangeSummary}
                onChange={(e) => setVersionChangeSummary(e.target.value)}
                placeholder="Explain the legal or investigative reason for this revision (e.g. Addition of CFSL Forensic Ballistics annexure, correction of memo date)..."
                rows={3}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="vContentText"
                className="text-xs font-semibold flex items-center justify-between"
              >
                <span>Operative Pleading & Document Text Snapshot</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Supports version diffing
                </span>
              </Label>
              <Textarea
                id="vContentText"
                value={versionContentText}
                onChange={(e) => setVersionContentText(e.target.value)}
                placeholder="Paste or amend the operative text of this version for side-by-side legal comparison..."
                rows={5}
                className="font-mono text-xs"
              />
            </div>

            <div className="text-[11px] text-muted-foreground border-t border-border/60 pt-2 flex items-center justify-between">
              <span>
                Uploader: <strong className="text-foreground">{staffName}</strong> ({staffRole})
              </span>
              <span>Target: Version v{doc.current_version + 1}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsNewVersionOpen(false)}
              disabled={newVersionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => newVersionMutation.mutate()}
              disabled={
                newVersionMutation.isPending ||
                !versionFileName.trim() ||
                versionChangeSummary.trim().length < 5
              }
              className="gap-1.5"
            >
              {newVersionMutation.isPending ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Sealing Version Block...
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  Commit Immutable Version v{doc.current_version + 1}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 3: VERIFY INTEGRITY MODAL */}
      {/* Displays exact requested layout: */}
      {/* Document Integrity: ✓ VERIFIED / ✗ INTEGRITY MISMATCH / ⚠️ UNAVAILABLE */}
      {/* SHA-256 */}
      {/* Version */}
      {/* Verified At */}
      {/* ========================================================================= */}
      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-5 text-emerald-600" />
              Cryptographic Integrity Verification
            </DialogTitle>
            <DialogDescription className="text-xs">
              Live algorithmic verification under Bharatiya Sakshya Adhiniyam, 2023 §63.
            </DialogDescription>
          </DialogHeader>

          {integrityResult ? (
            <div className="py-2">
              <IntegrityStatusCard
                result={integrityResult}
                onTamper={() => handleTamperSimulation(integrityResult.versionNumber)}
                onRestore={() => handleRestoreAuthentic(integrityResult.versionNumber)}
                onReverify={() => runVerification(integrityResult.versionNumber)}
                isVerifying={isVerifying}
              />
            </div>
          ) : (
            <div className="p-8 text-center">
              <RefreshCw className="size-6 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">
                Calculating cryptographic SHA-256 digest...
              </p>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setIsVerifyOpen(false)}>
              Close Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 4: DIGITAL SIGNATURE / APPROVAL WORKFLOW MODAL */}
      {/* ========================================================================= */}
      <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileCheck2 className="size-5 text-primary" />
              Digital Signature / Approval Workflow
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cryptographically seal an official electronic endorsement tied strictly to Document
              Version v{targetSignVersion ?? activeVersion.version_number}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {/* Version-Bound Isolation Guarantee Banner */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span>Version-Bound Cryptographic Endorsement:</span>
                <Badge className="font-mono text-xs bg-primary text-primary-foreground">
                  Version v{targetSignVersion ?? activeVersion.version_number}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                This digital approval will be permanently bound to Version v
                {targetSignVersion ?? activeVersion.version_number}. If a subsequent revision (e.g.
                v{(targetSignVersion ?? activeVersion.version_number) + 1}) is created in the
                future, this signature will <strong>not</strong> automatically apply to the new
                version.
              </p>
            </div>

            {/* Content SHA-256 Digest */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">SHA-256 Content Digest to be Sealed *</Label>
              <div className="rounded-md bg-muted/40 p-2.5 font-mono text-[11px] text-foreground break-all border border-border/60">
                {
                  (
                    versions.find(
                      (v) =>
                        v.version_number === (targetSignVersion ?? activeVersion.version_number),
                    ) || activeVersion
                  ).sha256_hash
                }
              </div>
            </div>

            {/* Signer User & Role */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sigUser" className="text-xs font-semibold">
                  Signer Full Name *
                </Label>
                <Input
                  id="sigUser"
                  value={signerCustomName || staffName}
                  onChange={(e) => setSignerCustomName(e.target.value)}
                  placeholder="e.g. ACP Virender Kumar"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sigRole" className="text-xs font-semibold">
                  Official Role *
                </Label>
                <Input
                  id="sigRole"
                  value={signerCustomRole || staffRole}
                  onChange={(e) => setSignerCustomRole(e.target.value)}
                  placeholder="e.g. registrar / judge"
                  required
                />
              </div>
            </div>

            {/* Endorsement Purpose / Rationale */}
            <div className="space-y-1.5">
              <Label htmlFor="sigPurpose" className="text-xs font-semibold">
                Purpose of Approval / Endorsement Note
              </Label>
              <Textarea
                id="sigPurpose"
                value={signaturePurpose}
                onChange={(e) => setSignaturePurpose(e.target.value)}
                placeholder="e.g. Verified official filing acceptance under Bharatiya Sakshya Adhiniyam, 2023 §63..."
                rows={3}
              />
            </div>

            {/* Prototype & Legal Disclaimer Checkbox */}
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="disclaimerCheck"
                  checked={signatureAcknowledged}
                  onChange={(e) => setSignatureAcknowledged(e.target.checked)}
                  className="mt-1 size-4 rounded border-border cursor-pointer"
                />
                <label
                  htmlFor="disclaimerCheck"
                  className="text-[11px] text-foreground font-medium leading-snug cursor-pointer"
                >
                  I endorse this digital approval and confirm that the document content matches the
                  computed SHA-256 digest.
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground pl-6 leading-relaxed">
                <strong>System Disclosure:</strong> Internal platform cryptographic endorsement.
                System architecture is digital-signature-ready for Controller of Certifying
                Authorities (CCA) Class 3 DSC tokens and NIC eSign Gateway API. (Not a
                government-certified DSC).
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSignDialogOpen(false)}
              disabled={signDocumentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => signDocumentMutation.mutate()}
              disabled={signDocumentMutation.isPending || !signatureAcknowledged}
              className="gap-1.5"
            >
              {signDocumentMutation.isPending ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Sealing Cryptographic Approval...
                </>
              ) : (
                <>
                  <FileCheck2 className="size-3.5" />
                  Confirm Digital Signature / Approval
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 5: TAMPER SIMULATION CONFIRMATION ALERT DIALOG */}
      {/* ========================================================================= */}
      <AlertDialog open={isTamperConfirmOpen} onOpenChange={setIsTamperConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Simulate File Tampering & Test Integrity Mismatch Detection?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed space-y-2">
              <p>
                This test alters the simulated vault storage payload for Version v
                {targetTamperVersion || selectedVersionNumber || doc.current_version} to verify that
                NyayaSetu&apos;s SHA-256 integrity verification engine immediately catches bit-level
                file alterations.
              </p>
              <p className="font-medium text-foreground">
                An <strong className="text-destructive">INTEGRITY_MISMATCH</strong> high-priority
                security audit record will be logged. You can click &quot;Restore Authentic
                File&quot; at any time to return the document to its original state.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = targetTamperVersion || selectedVersionNumber || doc.current_version;
                setIsTamperConfirmOpen(false);
                handleTamperSimulation(target);
              }}
            >
              Proceed with Tamper Simulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
