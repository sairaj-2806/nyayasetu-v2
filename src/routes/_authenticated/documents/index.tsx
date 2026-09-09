import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FilePlus,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Filter,
  Gavel,
  History,
  Lock,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
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
import { Textarea } from "@/components/ui/textarea";
import { useCurrentStaff, usePermissions } from "@/hooks/use-current-staff";
import {
  DOCUMENT_CATEGORIES,
  SENSITIVITY_TIERS,
  secureDocumentsQuery,
  uploadSecureDocument,
  verifyDocumentIntegrity,
  verifyDocumentVersionIntegrity,
  type DocumentCategory,
  type DocumentIntegrityResult,
  type DocumentSensitivityTier,
  type SecureDocument,
} from "@/lib/documents";
import { getAllDigitalSignatures } from "@/lib/digital-signature";
import { ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

export type DocumentRouteSearch = {
  upload?: boolean | undefined;
  caseNumber?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/documents/")({
  validateSearch: (search: Record<string, unknown>): DocumentRouteSearch => ({
    upload:
      search["upload"] === true || search["upload"] === "true" || search["upload"] === "1"
        ? true
        : undefined,
    caseNumber: typeof search["caseNumber"] === "string" ? (search["caseNumber"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Digital Documents & Pleadings — NyayaSetu" },
      {
        name: "description",
        content:
          "Secure digital document repository for legal filings, police investigation records, and evidence certificates.",
      },
    ],
  }),
  component: DocumentsListPage,
});

function getCategoryBadge(category: DocumentCategory) {
  switch (category) {
    case "FIR":
      return (
        <Badge className="bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400">
          FIR
        </Badge>
      );
    case "Charge Sheet":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400">
          Charge Sheet
        </Badge>
      );
    case "Forensic Report":
      return (
        <Badge className="bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-400">
          Forensic Report
        </Badge>
      );
    case "Seizure Memo":
      return (
        <Badge className="bg-cyan-500/15 text-cyan-700 border-cyan-500/30 dark:text-cyan-400">
          Seizure Memo
        </Badge>
      );
    case "Witness Statement":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400">
          Witness Statement
        </Badge>
      );
    case "Chain of Custody Document":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400">
          Custody Record
        </Badge>
      );
    case "Judgment":
      return (
        <Badge className="bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-400">
          Judgment / Order
        </Badge>
      );
    default:
      return <Badge variant="outline">{category}</Badge>;
  }
}

function getSensitivityBadge(tier: DocumentSensitivityTier) {
  const conf = SENSITIVITY_TIERS.find((t) => t.tier === tier);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border",
        conf?.badgeClass,
      )}
    >
      {tier === "SEALED_COVER_IN_CAMERA" && <Lock className="size-3" />}
      {conf?.label || tier}
    </span>
  );
}

function DocumentsListPage() {
  const queryClient = useQueryClient();
  const staff = useCurrentStaff();
  const staffName = staff.data?.fullName || "Registry Staff";
  const staffRole = staff.data?.role || "police_officer";
  const permissions = usePermissions();

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | "ALL">("ALL");
  const [sensitivityFilter, setSensitivityFilter] = useState<DocumentSensitivityTier | "ALL">(
    "ALL",
  );

  const docsQuery = useQuery(
    secureDocumentsQuery({
      searchQuery: searchQuery || undefined,
      category: categoryFilter,
      sensitivity: sensitivityFilter,
      userRole: staffRole,
      judgeId: staff.data?.judgeId,
    }),
  );

  const searchParams = Route.useSearch();

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(Boolean(searchParams?.upload));
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("FIR");
  const [sensitivityTier, setSensitivityTier] = useState<DocumentSensitivityTier>("PUBLIC");
  const [firNumber, setFirNumber] = useState("");
  const [policeStation, setPoliceStation] = useState("Connaught Place Police Station, New Delhi");
  const [caseNumber, setCaseNumber] = useState(searchParams?.caseNumber || "");
  const [assetCode, setAssetCode] = useState("");
  const [fileName, setFileName] = useState("");
  const [contentText, setContentText] = useState("");
  const [notes, setNotes] = useState("");

  // Verification Modal State
  const [selectedDocToVerify, setSelectedDocToVerify] = useState<SecureDocument | null>(null);
  const [liveIntegrityResult, setLiveIntegrityResult] = useState<DocumentIntegrityResult | null>(
    null,
  );
  const [isVerifyingIndex, setIsVerifyingIndex] = useState(false);

  const handleVerifyDoc = async (doc: SecureDocument) => {
    setSelectedDocToVerify(doc);
    setIsVerifyingIndex(true);
    try {
      const res = await verifyDocumentVersionIntegrity({
        documentId: doc.id,
        versionNumber: doc.current_version,
        verifierName: staffName,
        verifierRole: staffRole,
      });
      setLiveIntegrityResult(res);
      queryClient.invalidateQueries({ queryKey: ["secure-documents"] });

      if (res.status === "VERIFIED") {
        toast.success(
          `Integrity verified for ${doc.document_number}: SHA-256 matches recorded deposit hash.`,
        );
      } else if (res.status === "INTEGRITY_MISMATCH") {
        toast.error(
          `SECURITY ALERT: Integrity mismatch detected for ${doc.document_number}! High-priority alert logged.`,
        );
      } else {
        toast.warning(`Integrity warning for ${doc.document_number}: Storage payload unavailable.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to execute integrity verification.");
    } finally {
      setIsVerifyingIndex(false);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Document title is required.");
      if (!fileName.trim()) throw new Error("File attachment name is required.");

      return uploadSecureDocument({
        title: title.trim(),
        category,
        firNumber: firNumber.trim() || undefined,
        policeStation: policeStation.trim() || undefined,
        sensitivityTier,
        fileName: fileName.trim().endsWith(".pdf") ? fileName.trim() : `${fileName.trim()}.pdf`,
        fileFormat: "PDF/A",
        fileSizeBytes: Math.floor(250000 + Math.random() * 2500000),
        caseNumber: caseNumber.trim() || undefined,
        caseId: caseNumber.trim() ? "demo-case" : undefined,
        assetCode: assetCode.trim() || undefined,
        assetId: assetCode.trim() ? "ast_ev_01" : undefined,
        originatingAgency: "State Criminal Registry & CCTNS Portal",
        notes: notes.trim() || undefined,
        contentText: contentText.trim() || undefined,
        uploadedByName: staffName,
        uploadedByRole: staffRole,
      });
    },
    onSuccess: (newDoc) => {
      toast.success(
        `Document ${newDoc.document_number} uploaded securely with SHA-256 integrity digest.`,
      );
      setIsUploadOpen(false);
      setTitle("");
      setFileName("");
      setContentText("");
      setNotes("");
      setCaseNumber("");
      setAssetCode("");
      queryClient.invalidateQueries({ queryKey: ["secure-documents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const docs = docsQuery.data ?? [];

  const signaturesQuery = useQuery({
    queryKey: ["all-digital-signatures"],
    queryFn: async () => getAllDigitalSignatures(),
  });
  const allSignatures = signaturesQuery.data || [];

  // Summary Metrics
  const stats = useMemo(() => {
    const total = docs.length;
    const firAndCs = docs.filter(
      (d) => d.category === "FIR" || d.category === "Charge Sheet",
    ).length;
    const forensicAndMemos = docs.filter(
      (d) =>
        d.category === "Forensic Report" ||
        d.category === "Seizure Memo" ||
        d.category === "Evidence Record",
    ).length;
    const sealed = docs.filter(
      (d) => d.sensitivity_tier === "SEALED_COVER_IN_CAMERA" || d.is_sealed,
    ).length;
    return { total, firAndCs, forensicAndMemos, sealed };
  }, [docs]);

  if (docsQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Bharatiya Sakshya Adhiniyam, 2023 §63 Compliant"
          title="Secure Digital Document Repository"
          description="Encrypted, tamper-evident document vault for FIRs, police charge sheets, forensic certificates, seizure memos, and court pleadings."
        />
        <ErrorState
          title="Unable to load secure document vault"
          error={docsQuery.error}
          onRetry={() => docsQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Bharatiya Sakshya Adhiniyam, 2023 §63 Compliant"
        title="Secure Digital Document Repository"
        description="Encrypted, tamper-evident document vault for FIRs, police charge sheets, forensic certificates, seizure memos, and court pleadings."
        actions={
          staff.isLoading ? (
            <Skeleton className="h-9 w-32" />
          ) : permissions.canUploadDocuments || permissions.isAdmin || staff.data?.role === "admin" || staff.data?.role === "registrar" ? (
            <Button onClick={() => setIsUploadOpen(true)} className="gap-1.5 text-xs shadow-xs">
              <UploadCloud className="size-4" />
              Upload Document
            </Button>
          ) : (
            <Badge
              variant="outline"
              className="text-xs text-muted-foreground py-1.5 px-3 gap-1.5 border-border/80"
            >
              <Lock className="size-3 text-muted-foreground" />
              Upload Restricted ({staffRole})
            </Badge>
          )
        }
      />

      {/* KPI Metric Cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Total Managed Documents
            </CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center justify-between">
              {stats.total}
              <FileText className="size-5 text-primary opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Immutable legal filings & evidence exhibits
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              FIRs & Charge Sheets
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
              {stats.firAndCs}
              <FileSpreadsheet className="size-5 text-amber-600 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Primary criminal complaints & police filings
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Forensic & Seizure Memos
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-purple-600 dark:text-purple-400 flex items-center justify-between">
              {stats.forensicAndMemos}
              <Shield className="size-5 text-purple-600 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Scientific ballistic, cyber, and panchnama records
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Sealed Cover / In-Camera
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-destructive flex items-center justify-between">
              {stats.sealed}
              <Lock className="size-5 text-destructive opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Restricted to presiding judicial bench only
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search Control Bar */}
      <Card className="mt-8 shadow-xs border-border/80">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 items-center">
            {/* Live Search */}
            <div className="relative md:col-span-6">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, document ID, FIR number, case, or exhibit..."
                aria-label="Search documents by title, document ID, FIR number, case, or exhibit"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            {/* Category Filter */}
            <div className="md:col-span-3">
              <Select
                value={categoryFilter}
                onValueChange={(val) => setCategoryFilter(val as DocumentCategory | "ALL")}
              >
                <SelectTrigger className="text-xs h-9" aria-label="Filter documents by category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories (13 Types)</SelectItem>
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sensitivity Filter */}
            <div className="md:col-span-3">
              <Select
                value={sensitivityFilter}
                onValueChange={(val) =>
                  setSensitivityFilter(val as DocumentSensitivityTier | "ALL")
                }
              >
                <SelectTrigger
                  className="text-xs h-9"
                  aria-label="Filter documents by sensitivity tier"
                >
                  <SelectValue placeholder="All Sensitivity Tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sensitivity Tiers</SelectItem>
                  {SENSITIVITY_TIERS.map((tier) => (
                    <SelectItem key={tier.tier} value={tier.tier}>
                      {tier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card className="mt-6 shadow-xs border-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileSearch className="size-4 text-primary" />
                Document Vault Registry
                <Badge variant="secondary" className="text-xs ml-1 font-mono">
                  {docs.length} Records
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Click any record to inspect full version tree, cryptographic hashes, and access
                history.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {docsQuery.isLoading ? (
            <div className="p-8 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : docs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileSearch className="mx-auto size-9 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium text-foreground">
                No documents matched filter criteria
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Try adjusting your category or search query, or upload a new record.
              </p>
              {(permissions.canUploadDocuments || permissions.isAdmin || staff.data?.role === "admin" || staff.data?.role === "registrar") && (
                <Button
                  onClick={() => setIsUploadOpen(true)}
                  size="sm"
                  className="mt-4 gap-1.5 text-xs shadow-xs"
                >
                  <UploadCloud className="size-3.5" />
                  Upload Document
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[140px]">Document No</TableHead>
                    <TableHead>Title & Particulars</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Sensitivity</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Association</TableHead>
                    <TableHead>Integrity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-muted/30">
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
                      <TableCell className="max-w-[280px]">
                        <Link
                          to="/documents/$documentId"
                          params={{ documentId: doc.id }}
                          className="text-xs font-medium text-foreground hover:text-primary hover:underline line-clamp-1"
                        >
                          {doc.title}
                        </Link>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <span>{doc.file_name}</span>
                          <span>•</span>
                          <span>{(doc.file_size_bytes / 1024).toFixed(0)} KB</span>
                        </div>
                      </TableCell>
                      <TableCell>{getCategoryBadge(doc.category)}</TableCell>
                      <TableCell>{getSensitivityBadge(doc.sensitivity_tier)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            v{doc.current_version}
                          </Badge>
                          {(() => {
                            const isTampered = doc.is_tampered;
                            const sig = allSignatures.find(
                              (s) =>
                                s.entity_type === "DOCUMENT_VERSION" &&
                                s.entity_id === doc.id &&
                                s.version_number === doc.current_version,
                            );
                            if (isTampered || sig?.signature_status === "INVALID") {
                              return (
                                <span className="text-[9px] font-bold text-destructive block">
                                  Sig: INVALID
                                </span>
                              );
                            }
                            if (sig?.signature_status === "SIGNED") {
                              return (
                                <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                                  ✓ Signed
                                </span>
                              );
                            }
                            return (
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 block">
                                Pending Sig
                              </span>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {doc.case_number ? (
                          <div className="flex items-center gap-1 font-medium text-foreground">
                            <Gavel className="size-3 text-primary" />
                            {doc.case_number}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {doc.asset_code && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                            Exhibit: {doc.asset_code}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {doc.is_tampered ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive">
                            <XCircle className="size-3" /> MISMATCH
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" /> VERIFIED
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-primary gap-1"
                          >
                            <Link to="/documents/$documentId" params={{ documentId: doc.id }}>
                              <Eye className="size-3.5" />
                              View
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1"
                            onClick={() => handleVerifyDoc(doc)}
                            disabled={isVerifyingIndex && selectedDocToVerify?.id === doc.id}
                          >
                            {isVerifyingIndex && selectedDocToVerify?.id === doc.id ? (
                              <RefreshCw className="size-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="size-3" />
                            )}
                            Verify
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

      {/* Upload Secure Document Modal */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UploadCloud className="size-5 text-primary" />
              Upload Document to Secure Legal Vault
            </DialogTitle>
            <DialogDescription className="text-xs">
              Every upload calculates a cryptographic SHA-256 checksum and binds to the judicial
              audit log under Section 63 BSA 2023.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="docTitle" className="text-xs font-semibold">
                Document Title *
              </Label>
              <Input
                id="docTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Supplementary Forensic Ballistics Examination Certificate"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="docCat" className="text-xs font-semibold">
                  Document Category *
                </Label>
                <Select
                  value={category}
                  onValueChange={(val) => setCategory(val as DocumentCategory)}
                >
                  <SelectTrigger id="docCat" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sensitivity" className="text-xs font-semibold">
                  Sensitivity Classification *
                </Label>
                <Select
                  value={sensitivityTier}
                  onValueChange={(val) => setSensitivityTier(val as DocumentSensitivityTier)}
                >
                  <SelectTrigger id="sensitivity" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SENSITIVITY_TIERS.map((tier) => (
                      <SelectItem key={tier.tier} value={tier.tier}>
                        {tier.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="caseNo" className="text-xs font-semibold">
                  Associated Case Number
                </Label>
                <Input
                  id="caseNo"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="e.g. CR/2024/00491"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assetId" className="text-xs font-semibold">
                  Associated Evidence Exhibit Code
                </Label>
                <Input
                  id="assetId"
                  value={assetCode}
                  onChange={(e) => setAssetCode(e.target.value)}
                  placeholder="e.g. EX-2024-9021"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firNo" className="text-xs font-semibold">
                  Police FIR Number
                </Label>
                <Input
                  id="firNo"
                  value={firNumber}
                  onChange={(e) => setFirNumber(e.target.value)}
                  placeholder="e.g. FIR 491/2024"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pStation" className="text-xs font-semibold">
                  Police Station
                </Label>
                <Input
                  id="pStation"
                  value={policeStation}
                  onChange={(e) => setPoliceStation(e.target.value)}
                  placeholder="e.g. Connaught Place PS"
                />
              </div>
            </div>

            {/* Interactive File Attachment Dropzone */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select File from Device</Label>
              <div
                className="border-2 border-dashed border-border/80 rounded-lg p-3.5 text-center hover:border-primary/60 hover:bg-muted/40 transition-colors cursor-pointer bg-muted/20"
                onClick={() => document.getElementById("fileAttachmentPicker")?.click()}
              >
                <input
                  id="fileAttachmentPicker"
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.tiff,.png,.jpg,.jpeg,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFileName(file.name);
                      if (!title.trim()) {
                        setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
                      }
                      if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          if (typeof evt.target?.result === "string") {
                            setContentText(evt.target.result.slice(0, 5000));
                          }
                        };
                        reader.readAsText(file);
                      }
                    }
                  }}
                />
                <UploadCloud className="size-6 text-primary mx-auto mb-1 opacity-80" />
                <p className="text-xs font-medium text-foreground">
                  {fileName ? (
                    <span className="text-emerald-600 font-semibold">{fileName}</span>
                  ) : (
                    "Click to select file from device or drag and drop"
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  PDF, DOCX, TIFF, PNG, JPG up to 50 MB
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fileName" className="text-xs font-semibold">
                File Attachment Name *
              </Label>
              <Input
                id="fileName"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g. Ballistics_Report_Signed.pdf"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="contentText"
                className="text-xs font-semibold flex items-center justify-between"
              >
                <span>Document Transcript / Extracted Text Preview</span>
                <span className="text-[10px] text-muted-foreground">
                  (Optional for instant previewer)
                </span>
              </Label>
              <Textarea
                id="contentText"
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder="Paste key legal text, operative findings, or memo particulars..."
                rows={4}
              />
            </div>

            {/* Allowed Formats and File Size Limit Guidance */}
            <div className="rounded-md border border-border/80 bg-muted/30 p-2.5 text-[11px] text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span>
                Allowed formats:{" "}
                <strong className="text-foreground">PDF, PDF/A, DOCX, TIFF, PNG, JPG</strong>
              </span>
              <span>
                Max file size: <strong className="text-foreground">50 MB</strong>
              </span>
            </div>

            <div className="text-[11px] text-muted-foreground">
              Deposited by: <strong className="text-foreground">{staffName}</strong> ({staffRole})
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUploadOpen(false)}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !title.trim() || !fileName.trim()}
              className="gap-1.5"
            >
              {uploadMutation.isPending ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Encrypting & Registering...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Upload & Register
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Instant Integrity Verification Dialog */}
      <Dialog
        open={!!selectedDocToVerify}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDocToVerify(null);
            setLiveIntegrityResult(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-5 text-emerald-600" />
              Cryptographic Integrity Verification
            </DialogTitle>
            <DialogDescription className="text-xs">
              Algorithmic verification under Bharatiya Sakshya Adhiniyam, 2023 §63.
            </DialogDescription>
          </DialogHeader>

          {selectedDocToVerify && (
            <div className="space-y-4 py-2">
              {liveIntegrityResult ? (
                <div className="space-y-4">
                  {/* Required Status Layout: Document Integrity, SHA-256, Version, Verified At */}
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-xs">
                    {/* Document Integrity */}
                    <div className="flex flex-col gap-1 border-b border-border/60 pb-2.5">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Document Integrity
                      </p>
                      {liveIntegrityResult.status === "VERIFIED" ? (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-base">
                          <CheckCircle2 className="size-4.5 shrink-0" />
                          <span>✓ VERIFIED</span>
                        </div>
                      ) : liveIntegrityResult.status === "INTEGRITY_MISMATCH" ? (
                        <div className="flex items-center gap-2 text-destructive font-bold text-base">
                          <XCircle className="size-4.5 shrink-0" />
                          <span>✗ INTEGRITY MISMATCH</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-base">
                          <AlertTriangle className="size-4.5 shrink-0" />
                          <span>⚠️ UNAVAILABLE</span>
                        </div>
                      )}
                    </div>

                    {/* SHA-256 */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        SHA-256
                      </p>
                      <div className="rounded-md bg-muted/40 p-2.5 font-mono text-xs text-foreground break-all border border-border/60">
                        {liveIntegrityResult.status === "INTEGRITY_MISMATCH" ? (
                          <div className="space-y-2">
                            <div>
                              <span className="text-[10px] text-destructive uppercase font-sans font-bold block">
                                Calculated Current Hash (Altered):
                              </span>
                              <span className="text-destructive font-bold">
                                {liveIntegrityResult.computedSha256}
                              </span>
                            </div>
                            <div className="border-t border-border/40 pt-1.5">
                              <span className="text-[10px] text-muted-foreground uppercase font-sans font-semibold block">
                                Immutable Recorded Deposit Hash (Preserved):
                              </span>
                              <span className="text-foreground">
                                {liveIntegrityResult.recordedSha256}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span>
                            {liveIntegrityResult.computedSha256 ||
                              liveIntegrityResult.recordedSha256}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Version & Verified At */}
                    <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-2.5">
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Version
                        </p>
                        <p className="font-mono text-sm font-bold text-foreground">
                          {liveIntegrityResult.versionNumber}
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Verified At
                        </p>
                        <p className="text-xs font-medium text-foreground">
                          {new Date(liveIntegrityResult.verifiedAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          {new Date(liveIntegrityResult.verifiedAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Security Alert on Mismatch */}
                  {liveIntegrityResult.status === "INTEGRITY_MISMATCH" && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive space-y-1.5">
                      <div className="flex items-center gap-2 font-bold">
                        <ShieldAlert className="size-4 shrink-0" />
                        HIGH-PRIORITY SECURITY AUDIT EVENT DISPATCHED
                      </div>
                      <p className="text-[11px] opacity-95">
                        Cryptographic checksum does not match the immutable recorded deposit hash!
                        Original deposit hash was <strong>NOT overwritten</strong>.
                      </p>
                    </div>
                  )}

                  {/* Statutory BSA §63 Clause */}
                  <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 text-[11px] text-muted-foreground space-y-0.5">
                    <p className="font-semibold text-foreground">
                      Bharatiya Sakshya Adhiniyam, 2023 §63
                    </p>
                    <p>{liveIntegrityResult.bsaSection63Clause}</p>
                  </div>

                  {/* Blockchain / Consortium Ledger Anchoring Note */}
                  <div className="rounded-lg border border-border/80 bg-muted/15 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                        <Scale className="size-3 text-primary" />
                        Consortium Ledger Anchoring Readiness
                      </span>
                      <Badge variant="outline" className="text-[9px] text-primary">
                        RFC-6962
                      </Badge>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate">
                      Merkle Leaf: {liveIntegrityResult.ledgerAnchor.merkleLeafHash}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/40">
                      SHA-256 provides deterministic mathematical integrity verification. Hashes are
                      formatted for periodic anchoring to the National Judicial Consortium Ledger.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <RefreshCw className="size-6 animate-spin mx-auto text-primary" />
                  <p className="text-xs text-muted-foreground">
                    Calculating SHA-256 cryptographic digest...
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => {
                setSelectedDocToVerify(null);
                setLiveIntegrityResult(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
