import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Gavel,
  History,
  Info,
  Loader2,
  Pencil,
  Scale,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  caseCategoriesQuery,
  CASE_STATUSES,
  statusLabel,
  validateCnrNumber,
  type CaseRow,
  type CaseStatus,
} from "@/lib/cases";
import { recomputeCasePriority } from "@/lib/priority";
import { recordAudit } from "@/lib/audit";
import { useCurrentStaff, usePermissions } from "@/hooks/use-current-staff";

type EditCaseModalProps = {
  caseRow: CaseRow;
  triggerButton?: React.ReactNode;
  onUpdated?: () => void;
};

export function EditCaseModal({ caseRow, triggerButton, onUpdated }: EditCaseModalProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const staff = useCurrentStaff();
  const perms = usePermissions();

  const isAuthorized = perms.isAdmin || perms.canSchedule;
  const categories = useQuery(caseCategoriesQuery);

  // Form State
  const [caseNumber, setCaseNumber] = useState(caseRow.case_number || "");
  const [cnrNumber, setCnrNumber] = useState(caseRow.cnr_number || "");
  const [categoryId, setCategoryId] = useState(caseRow.category_id || "");
  const [status, setStatus] = useState<CaseStatus>(caseRow.status || "filed");
  const [filingDate, setFilingDate] = useState(caseRow.filing_date || "");
  const [parties, setParties] = useState(caseRow.parties || "");
  const [estimatedDuration, setEstimatedDuration] = useState(
    String(caseRow.estimated_duration_minutes || 60),
  );
  const [previousAdjournments, setPreviousAdjournments] = useState(
    String(caseRow.previous_adjournments || 0),
  );

  // Statutory & Priority Flags
  const [isFtscPocso, setIsFtscPocso] = useState(Boolean(caseRow.is_ftsc_pocso));
  const [seniorCitizen, setSeniorCitizen] = useState(Boolean(caseRow.senior_citizen_litigant));
  const [propertyDispute5yr, setPropertyDispute5yr] = useState(
    Boolean(caseRow.property_dispute_5yr_plus),
  );
  const [limitationDeadline, setLimitationDeadline] = useState(
    caseRow.statutory_limitation_deadline || "",
  );
  const [legalPriorityFlag, setLegalPriorityFlag] = useState(
    Boolean(caseRow.legal_priority_flag),
  );

  // Registry Amendment Justification
  const [amendmentReason, setAmendmentReason] = useState("");

  // Sync state whenever modal opens or caseRow updates
  useEffect(() => {
    if (open) {
      setCaseNumber(caseRow.case_number || "");
      setCnrNumber(caseRow.cnr_number || "");
      setCategoryId(caseRow.category_id || "");
      setStatus(caseRow.status || "filed");
      setFilingDate(caseRow.filing_date || "");
      setParties(caseRow.parties || "");
      setEstimatedDuration(String(caseRow.estimated_duration_minutes || 60));
      setPreviousAdjournments(String(caseRow.previous_adjournments || 0));
      setIsFtscPocso(Boolean(caseRow.is_ftsc_pocso));
      setSeniorCitizen(Boolean(caseRow.senior_citizen_litigant));
      setPropertyDispute5yr(Boolean(caseRow.property_dispute_5yr_plus));
      setLimitationDeadline(caseRow.statutory_limitation_deadline || "");
      setLegalPriorityFlag(Boolean(caseRow.legal_priority_flag));
      setAmendmentReason("");
    }
  }, [open, caseRow]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!caseNumber.trim()) {
        throw new Error("Case number cannot be empty.");
      }
      if (!filingDate) {
        throw new Error("Filing date is required.");
      }
      if (!parties.trim()) {
        throw new Error("Parties details cannot be empty.");
      }
      const dur = Number(estimatedDuration);
      if (Number.isNaN(dur) || dur <= 0) {
        throw new Error("Estimated hearing duration must be a positive number.");
      }
      const adj = Number(previousAdjournments);
      if (Number.isNaN(adj) || adj < 0) {
        throw new Error("Previous adjournments must be zero or a positive integer.");
      }

      const payload = {
        case_number: caseNumber.trim(),
        cnr_number: cnrNumber.trim() || null,
        category_id: categoryId || null,
        status,
        filing_date: filingDate,
        parties: parties.trim(),
        estimated_duration_minutes: dur,
        previous_adjournments: adj,
        is_ftsc_pocso: isFtscPocso,
        senior_citizen_litigant: seniorCitizen,
        property_dispute_5yr_plus: propertyDispute5yr,
        statutory_limitation_deadline: limitationDeadline || null,
        legal_priority_flag: legalPriorityFlag,
      };

      const { error } = await (supabase.from("cases") as any).update(payload).eq("id", caseRow.id);
      if (error) throw error;

      // Automatically recalculate deterministic priority score and tier
      await recomputeCasePriority(caseRow.id);

      // Record immutable audit entry
      const modifier = staff.data?.fullName || staff.data?.email || "Registry Staff";
      const reasonSuffix = amendmentReason.trim()
        ? ` Reason: "${amendmentReason.trim()}"`
        : "";
      await recordAudit(
        `Registrar/Admin ${modifier} edited particulars for Case ${caseNumber}.${reasonSuffix}`,
        `case:${caseNumber}`,
      );
    },
    onSuccess: () => {
      toast.success(`Case particulars for ${caseNumber} updated successfully.`);
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["adjournments", caseRow.id] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      setOpen(false);
      onUpdated?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update case details. Please try again.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Pencil className="size-3.5" />
            Edit Case Details
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Scale className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Edit Case Particulars</DialogTitle>
              <DialogDescription className="text-xs">
                Update registered case details, parties, hearing expectations, and statutory flags.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!isAuthorized && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <p>
              Only authorized Court Registrars or System Administrators possess authority to amend
              registered court records.
            </p>
          </div>
        )}

        <Tabs defaultValue="particulars" className="space-y-4 pt-2">
          <TabsList className="grid grid-cols-3 w-full bg-muted/70">
            <TabsTrigger value="particulars" className="text-xs gap-1.5">
              <FileText className="size-3.5" /> Particulars
            </TabsTrigger>
            <TabsTrigger value="parties" className="text-xs gap-1.5">
              <Users className="size-3.5" /> Litigants & Time
            </TabsTrigger>
            <TabsTrigger value="statutory" className="text-xs gap-1.5">
              <ShieldAlert className="size-3.5" /> Statutory Flags
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Core Particulars */}
          <TabsContent value="particulars" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="case-number" className="text-xs font-semibold">
                  Case Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="case-number"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="e.g. CIV-2026-0001"
                  className="font-mono text-sm"
                  disabled={!isAuthorized || updateMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cnr-number" className="text-xs font-semibold">
                  16-Digit CNR Number
                </Label>
                <Input
                  id="cnr-number"
                  value={cnrNumber}
                  onChange={(e) => setCnrNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. DLCT01-000014-2026"
                  className="font-mono text-sm"
                  disabled={!isAuthorized || updateMutation.isPending}
                />
                {cnrNumber && !validateCnrNumber(cnrNumber) && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Warning: Syntax does not strictly match standard 16-character CNR pattern.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="case-category" className="text-xs font-semibold">
                  Case Category
                </Label>
                <Select
                  value={categoryId}
                  onValueChange={setCategoryId}
                  disabled={!isAuthorized || updateMutation.isPending}
                >
                  <SelectTrigger id="case-category">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.data ?? []).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="case-status" className="text-xs font-semibold">
                  Listing / Proceedings Status
                </Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val as CaseStatus)}
                  disabled={!isAuthorized || updateMutation.isPending}
                >
                  <SelectTrigger id="case-status">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {CASE_STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {statusLabel[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="filing-date" className="text-xs font-semibold">
                  Filing Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="filing-date"
                  type="date"
                  value={filingDate}
                  onChange={(e) => setFilingDate(e.target.value)}
                  disabled={!isAuthorized || updateMutation.isPending}
                />
                <p className="text-[11px] text-muted-foreground">
                  Altering the filing date immediately updates the case pending duration.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prev-adjournments" className="text-xs font-semibold">
                  Previous Adjournments Count
                </Label>
                <Input
                  id="prev-adjournments"
                  type="number"
                  min="0"
                  max="50"
                  value={previousAdjournments}
                  onChange={(e) => setPreviousAdjournments(e.target.value)}
                  disabled={!isAuthorized || updateMutation.isPending}
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Litigants & Duration */}
          <TabsContent value="parties" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="parties-involved" className="text-xs font-semibold">
                Litigants & Memo of Parties <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="parties-involved"
                rows={3}
                value={parties}
                onChange={(e) => setParties(e.target.value)}
                placeholder="e.g. Ramesh Chandra & Ors. vs State of NCT & Anr."
                disabled={!isAuthorized || updateMutation.isPending}
              />
              <p className="text-[11px] text-muted-foreground">
                Consolidated title shown on cause-lists, summons, and judicial rosters.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="est-duration" className="text-xs font-semibold">
                  Estimated Hearing Duration (Minutes)
                </Label>
                <Input
                  id="est-duration"
                  type="number"
                  step="15"
                  min="15"
                  max="480"
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(e.target.value)}
                  disabled={!isAuthorized || updateMutation.isPending}
                />
                <p className="text-[11px] text-muted-foreground">
                  Bench time allocated by the smart scheduling algorithm.
                </p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/20 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Clock className="size-4 text-primary" />
                  <span>Duration Reference</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Default civil/bail is 45-60 min; substantive criminal trials typically 90+ min.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Statutory Priority Flags */}
          <TabsContent value="statutory" className="space-y-4">
            <div className="space-y-3 rounded-lg border p-3.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="ftsc-flag" className="text-xs font-semibold cursor-pointer">
                    Fast Track Special Court (POCSO / Gender Offence)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Grants +30 priority weighting for statutory expedited disposal.
                  </p>
                </div>
                <Switch
                  id="ftsc-flag"
                  checked={isFtscPocso}
                  onCheckedChange={setIsFtscPocso}
                  disabled={!isAuthorized || updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-2.5">
                <div>
                  <Label htmlFor="senior-flag" className="text-xs font-semibold cursor-pointer">
                    Senior Citizen Litigant
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Prioritises causes involving elderly litigants aged 60+.
                  </p>
                </div>
                <Switch
                  id="senior-flag"
                  checked={seniorCitizen}
                  onCheckedChange={setSeniorCitizen}
                  disabled={!isAuthorized || updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-2.5">
                <div>
                  <Label htmlFor="property-flag" className="text-xs font-semibold cursor-pointer">
                    Property Dispute Pending &gt; 5 Years
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Long-pending land title or partition suit backlog remediation.
                  </p>
                </div>
                <Switch
                  id="property-flag"
                  checked={propertyDispute5yr}
                  onCheckedChange={setPropertyDispute5yr}
                  disabled={!isAuthorized || updateMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-2.5">
                <div>
                  <Label htmlFor="legal-priority" className="text-xs font-semibold cursor-pointer">
                    Administrative / Bench Priority Directive
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Special order flag issued by Principal District Judge.
                  </p>
                </div>
                <Switch
                  id="legal-priority"
                  checked={legalPriorityFlag}
                  onCheckedChange={setLegalPriorityFlag}
                  disabled={!perms.isAdmin || updateMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="limitation-deadline" className="text-xs font-semibold">
                Statutory Limitation Deadline
              </Label>
              <Input
                id="limitation-deadline"
                type="date"
                value={limitationDeadline}
                onChange={(e) => setLimitationDeadline(e.target.value)}
                disabled={!isAuthorized || updateMutation.isPending}
              />
              <p className="text-[11px] text-muted-foreground">
                Leave empty if no statutory bar or limitation countdown applies.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Audit Justification Field */}
        <div className="mt-2 space-y-1.5 rounded-md border border-dashed border-border bg-muted/30 p-3">
          <Label htmlFor="amendment-reason" className="text-xs font-semibold flex items-center gap-1.5">
            <History className="size-3.5 text-muted-foreground" />
            Amendment Reason / Judicial Order Ref (Optional)
          </Label>
          <Input
            id="amendment-reason"
            value={amendmentReason}
            onChange={(e) => setAmendmentReason(e.target.value)}
            placeholder="e.g. Memo of parties corrected as per order dated 09/09/2026"
            className="text-xs"
            disabled={!isAuthorized || updateMutation.isPending}
          />
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={!isAuthorized || updateMutation.isPending}
            className="gap-1.5"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving Changes…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" /> Save Case Particulars
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
