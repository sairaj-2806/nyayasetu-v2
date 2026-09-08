import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Barcode,
  Calendar,
  CheckCircle2,
  FileCheck2,
  Gavel,
  Info,
  MapPin,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  Tag,
  User,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  assetCategoriesQuery,
  createPoliceAsset,
  generateAssetCode,
  type AssetCondition,
  type AssetLifecycleStatus,
} from "@/lib/assets";
import { casesQuery } from "@/lib/cases";

export const Route = createFileRoute("/_authenticated/assets/new")({
  head: () => ({
    meta: [
      { title: "Add Police Asset / Evidence — NyayaSetu" },
      {
        name: "description",
        content: "Register a new departmental asset or seized criminal evidence item.",
      },
    ],
  }),
  component: NewAssetPage,
});

function NewAssetPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const categories = useQuery(assetCategoriesQuery);
  const cases = useQuery(casesQuery);

  // Form State
  const [assetCode, setAssetCode] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<AssetLifecycleStatus>("REGISTERED");
  const [condition, setCondition] = useState<AssetCondition>("NEW");
  const [departmentStation, setDepartmentStation] = useState("North District Police Station");
  const [currentLocation, setCurrentLocation] = useState("Central Police Malkhana Room 1");
  const [currentCustodianName, setCurrentCustodianName] = useState("");
  const [assignedOfficerName, setAssignedOfficerName] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("none");
  const [firNumber, setFirNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [barcodeRfid, setBarcodeRfid] = useState("");
  const [tamperSealNumber, setTamperSealNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [vendorSupplier, setVendorSupplier] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [notes, setNotes] = useState("");

  // Initialize unique asset code once categories load
  useEffect(() => {
    if (!assetCode) {
      setAssetCode(generateAssetCode("AST"));
    }
  }, [assetCode]);

  // When category changes, auto-adjust code prefix if default
  function handleCategoryChange(catId: string) {
    setCategoryId(catId);
    const cat = (categories.data ?? []).find((c) => c.id === catId);
    if (cat) {
      setAssetCode(generateAssetCode(cat.code || "AST"));
    }
  }

  // Auto-fill FIR if case selected
  function handleCaseChange(caseId: string) {
    setSelectedCaseId(caseId);
    if (caseId !== "none") {
      const c = (cases.data ?? []).find((item) => item.id === caseId);
      if (c && !firNumber) {
        setFirNumber(`FIR-${c.case_number.replace(/[^0-9]/g, "") || "101"}/2026`);
      }
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Please enter an asset name");
      if (!assetCode.trim()) throw new Error("Please provide a unique asset code");
      if (!categoryId) throw new Error("Please select an asset category");
      if (!currentCustodianName.trim())
        throw new Error("Please specify the current custodian name");

      const selectedCat = (categories.data ?? []).find((c) => c.id === categoryId);

      return createPoliceAsset({
        asset_code: assetCode.trim().toUpperCase(),
        name: name.trim(),
        category_id: categoryId,
        category_name: selectedCat?.name,
        status,
        condition,
        department_station: departmentStation.trim(),
        current_location: currentLocation.trim(),
        current_custodian_name: currentCustodianName.trim(),
        assigned_officer_name: assignedOfficerName.trim() || undefined,
        case_id: selectedCaseId !== "none" ? selectedCaseId : null,
        fir_number: firNumber.trim() || null,
        serial_number: serialNumber.trim() || null,
        barcode_rfid: barcodeRfid.trim() || null,
        tamper_seal_number: tamperSealNumber.trim() || null,
        purchase_date: purchaseDate || null,
        purchase_cost: purchaseCost ? parseFloat(purchaseCost) : null,
        vendor_supplier: vendorSupplier.trim() || null,
        warranty_expiry: warrantyExpiry || null,
      });
    },
    onSuccess: (newAsset) => {
      toast.success(`Asset ${newAsset.asset_code} registered successfully!`);
      queryClient.invalidateQueries({ queryKey: ["police-assets"] });
      navigate({ to: "/assets/$assetId", params: { assetId: newAsset.id } });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to register asset");
    },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="mb-6 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Link to="/assets">
            <ArrowLeft className="size-4" />
            Back to Asset Registry
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="Custody Registration"
        title="Register New Police Asset / Evidence"
        description="Enroll departmental property, surveillance equipment, weapons, or seized evidence into the chain of custody."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="mt-8 space-y-8"
      >
        {/* Section 1: Identification & Classification */}
        <Card className="shadow-xs border-border/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="size-4 text-primary" />
              1. Asset Identification & Classification
            </CardTitle>
            <CardDescription>
              Unique identifier, descriptive name, and official category taxonomy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="assetCode"
                  className="text-xs font-semibold flex items-center justify-between"
                >
                  <span>Asset Unique Code *</span>
                  <button
                    type="button"
                    onClick={() => setAssetCode(generateAssetCode())}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="size-3" /> Regenerate
                  </button>
                </Label>
                <Input
                  id="assetCode"
                  value={assetCode}
                  onChange={(e) => setAssetCode(e.target.value)}
                  placeholder="e.g. POL-2026-AST-1049"
                  required
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs font-semibold">
                  Category / Classification *
                </Label>
                <Select value={categoryId} onValueChange={handleCategoryChange} required>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select Category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.is_evidence_category ? "(Evidence)" : "(Departmental)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">
                Asset / Evidence Title *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Seized Western Digital 4TB Hard Drive or Glock 17 Service Pistol"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-semibold">
                  Initial Status *
                </Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val as AssetLifecycleStatus)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REGISTERED">REGISTERED (Pending assignment)</SelectItem>
                    <SelectItem value="AVAILABLE">AVAILABLE (In armory / stock)</SelectItem>
                    <SelectItem value="ASSIGNED">ASSIGNED (Issued to officer)</SelectItem>
                    <SelectItem value="IN_USE">IN_USE (Active investigation)</SelectItem>
                    <SelectItem value="MAINTENANCE">MAINTENANCE (Under repair)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="condition" className="text-xs font-semibold">
                  Physical Condition *
                </Label>
                <Select
                  value={condition}
                  onValueChange={(val) => setCondition(val as AssetCondition)}
                >
                  <SelectTrigger id="condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">NEW (Unopened / Pristine)</SelectItem>
                    <SelectItem value="EXCELLENT">EXCELLENT (Flawless condition)</SelectItem>
                    <SelectItem value="GOOD">GOOD (Normal wear & tear)</SelectItem>
                    <SelectItem value="FAIR">FAIR (Operational with minor marks)</SelectItem>
                    <SelectItem value="NEEDS_REPAIR">
                      NEEDS_REPAIR (Faulty / requires service)
                    </SelectItem>
                    <SelectItem value="DAMAGED">DAMAGED (Compromised / deformed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Custody & Location Particulars */}
        <Card className="shadow-xs border-border/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              2. Custody & Physical Location
            </CardTitle>
            <CardDescription>
              Assign the officer in possession and the exact malkhana or storage room.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="station" className="text-xs font-semibold">
                  Police Department / Station *
                </Label>
                <Input
                  id="station"
                  value={departmentStation}
                  onChange={(e) => setDepartmentStation(e.target.value)}
                  placeholder="e.g. North District Police Station"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="location" className="text-xs font-semibold">
                  Current Storage Location / Room *
                </Label>
                <Input
                  id="location"
                  value={currentLocation}
                  onChange={(e) => setCurrentLocation(e.target.value)}
                  placeholder="e.g. Central Police Malkhana Room 1, Shelf B-4"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="custodian" className="text-xs font-semibold">
                  Current Custodian / Malkhana Moharrir *
                </Label>
                <Input
                  id="custodian"
                  value={currentCustodianName}
                  onChange={(e) => setCurrentCustodianName(e.target.value)}
                  placeholder="e.g. HC Ramesh Chand (Malkhana In-charge)"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="officer" className="text-xs font-semibold">
                  Assigned Investigating Officer (Optional)
                </Label>
                <Input
                  id="officer"
                  value={assignedOfficerName}
                  onChange={(e) => setAssignedOfficerName(e.target.value)}
                  placeholder="e.g. Sub-Inspector Deepak Sharma"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Case & Criminal Investigation Linkage */}
        <Card className="shadow-xs border-border/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gavel className="size-4 text-primary" />
              3. Case & Investigation Association (Optional)
            </CardTitle>
            <CardDescription>
              Link this asset directly to a pending court case or FIR for automated cause-list
              tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="caseSelect" className="text-xs font-semibold">
                  Associated Court Case
                </Label>
                <Select value={selectedCaseId} onValueChange={handleCaseChange}>
                  <SelectTrigger id="caseSelect">
                    <SelectValue placeholder="Select existing case..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Departmental Equipment)</SelectItem>
                    {(cases.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.case_number} — {c.parties?.slice(0, 30) || "Case"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fir" className="text-xs font-semibold">
                  FIR / Crime Diary Number
                </Label>
                <Input
                  id="fir"
                  value={firNumber}
                  onChange={(e) => setFirNumber(e.target.value)}
                  placeholder="e.g. FIR No. 142/2026 U/S 420 IPC"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Physical Identifiers & Procurement */}
        <Card className="shadow-xs border-border/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Barcode className="size-4 text-primary" />
              4. Physical Identifiers & Procurement Details
            </CardTitle>
            <CardDescription>
              Serial numbers, RFID tags, tamper-evident seals, and warranty records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="serial" className="text-xs font-semibold">
                  Serial Number / Part No.
                </Label>
                <Input
                  id="serial"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="e.g. SN-884920194"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="barcode" className="text-xs font-semibold">
                  Barcode / RFID Tag ID
                </Label>
                <Input
                  id="barcode"
                  value={barcodeRfid}
                  onChange={(e) => setBarcodeRfid(e.target.value)}
                  placeholder="e.g. RFID-IND-DEL-441"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tamperSeal" className="text-xs font-semibold">
                  Tamper Seal Number
                </Label>
                <Input
                  id="tamperSeal"
                  value={tamperSealNumber}
                  onChange={(e) => setTamperSealNumber(e.target.value)}
                  placeholder="e.g. MHA-SEAL-2026-99"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="purchaseDate" className="text-xs font-semibold">
                  Purchase / Seizure Date
                </Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="purchaseCost" className="text-xs font-semibold">
                  Purchase Cost (₹)
                </Label>
                <Input
                  id="purchaseCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  placeholder="e.g. 45000"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vendor" className="text-xs font-semibold">
                  Vendor / Supplier / Seized From
                </Label>
                <Input
                  id="vendor"
                  value={vendorSupplier}
                  onChange={(e) => setVendorSupplier(e.target.value)}
                  placeholder="e.g. Axon Enterprise / Accused"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="warranty" className="text-xs font-semibold">
                  Warranty Expiry Date
                </Label>
                <Input
                  id="warranty"
                  type="date"
                  value={warrantyExpiry}
                  onChange={(e) => setWarrantyExpiry(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold">
                Custody Notes / Special Storage Instructions
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Store in refrigerated bio-vault at -20°C or keep in double-lock armory safe."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button asChild variant="outline">
            <Link to="/assets">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending} className="gap-2 min-w-[150px]">
            {createMutation.isPending ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save & Register Asset
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
