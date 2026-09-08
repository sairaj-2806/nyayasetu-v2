import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Truck,
  Wrench,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  assetCategoriesQuery,
  policeAssetsQuery,
  type AssetCondition,
  type AssetLifecycleStatus,
  type PoliceAsset,
} from "@/lib/assets";
import { ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assets/")({
  head: () => ({
    meta: [
      { title: "Police Assets & Evidence — NyayaSetu" },
      {
        name: "description",
        content: "Police asset custody tracking, malkhana evidence register, and chain-of-custody lifecycle.",
      },
    ],
  }),
  component: PoliceAssetsPage,
});

function getStatusBadge(status: AssetLifecycleStatus) {
  switch (status) {
    case "AVAILABLE":
      return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-500/30 dark:text-emerald-400">Available</Badge>;
    case "ASSIGNED":
    case "IN_USE":
      return <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-500/30 dark:text-blue-400">{status === "IN_USE" ? "In Use" : "Assigned"}</Badge>;
    case "TRANSFERRED":
      return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/30 dark:text-amber-400">In Transfer</Badge>;
    case "MAINTENANCE":
      return <Badge className="bg-purple-500/15 text-purple-700 hover:bg-purple-500/25 border-purple-500/30 dark:text-purple-400">Maintenance</Badge>;
    case "RETURNED":
      return <Badge className="bg-cyan-500/15 text-cyan-700 hover:bg-cyan-500/25 border-cyan-500/30 dark:text-cyan-400">Returned</Badge>;
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
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="size-3" /> {condition}</span>;
    case "GOOD":
    case "FAIR":
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">{condition}</span>;
    case "DAMAGED":
    case "NEEDS_REPAIR":
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"><Wrench className="size-3" /> {condition.replace("_", " ")}</span>;
    case "DECOMMISSIONED":
    default:
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">{condition}</span>;
  }
}

function PoliceAssetsPage() {
  const assets = useQuery(policeAssetsQuery);
  const categories = useQuery(assetCategoriesQuery);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [custodianFilter, setCustodianFilter] = useState("all");
  const [caseFilter, setCaseFilter] = useState("all");

  // Distinct locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    if (!assets.data) return [];
    const locs = new Set<string>();
    for (const a of assets.data) {
      if (a.department_station) locs.add(a.department_station);
      if (a.current_location) locs.add(a.current_location);
    }
    return Array.from(locs).sort();
  }, [assets.data]);

  // Distinct custodians for filter dropdown
  const uniqueCustodians = useMemo(() => {
    if (!assets.data) return [];
    const custs = new Set<string>();
    for (const a of assets.data) {
      if (a.current_custodian_name) custs.add(a.current_custodian_name);
      if (a.assigned_officer_name) custs.add(a.assigned_officer_name);
    }
    return Array.from(custs).sort();
  }, [assets.data]);

  // Key KPI metric counts
  const stats = useMemo(() => {
    const list = assets.data ?? [];
    return {
      total: list.length,
      available: list.filter((a) => a.status === "AVAILABLE").length,
      assigned: list.filter((a) => a.status === "ASSIGNED" || a.status === "IN_USE").length,
      maintenance: list.filter((a) => a.status === "MAINTENANCE").length,
      transfer: list.filter((a) => a.status === "TRANSFERRED").length,
      retiredLost: list.filter((a) => a.status === "RETIRED" || a.status === "LOST").length,
    };
  }, [assets.data]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (assets.data ?? []).filter((item) => {
      // 1. Text Search
      if (q) {
        const matchCode = item.asset_code.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchSerial = (item.serial_number ?? "").toLowerCase().includes(q);
        const matchFir = (item.fir_number ?? "").toLowerCase().includes(q);
        const matchCase = (item.case_number ?? "").toLowerCase().includes(q);
        const matchCustodian = item.current_custodian_name.toLowerCase().includes(q);
        const matchOfficer = item.assigned_officer_name.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchSerial && !matchFir && !matchCase && !matchCustodian && !matchOfficer) {
          return false;
        }
      }

      // 2. Category Filter
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== "all") {
        if (statusFilter === "ASSIGNED_OR_IN_USE") {
          if (item.status !== "ASSIGNED" && item.status !== "IN_USE") return false;
        } else if (item.status !== statusFilter) {
          return false;
        }
      }

      // 4. Location / Station Filter
      if (locationFilter !== "all") {
        if (item.department_station !== locationFilter && item.current_location !== locationFilter) {
          return false;
        }
      }

      // 5. Custodian / Officer Filter
      if (custodianFilter !== "all") {
        if (item.current_custodian_name !== custodianFilter && item.assigned_officer_name !== custodianFilter) {
          return false;
        }
      }

      // 6. Case Association Filter
      if (caseFilter === "linked" && !item.case_id && !item.case_number) {
        return false;
      }
      if (caseFilter === "unlinked" && (item.case_id || item.case_number)) {
        return false;
      }

      return true;
    });
  }, [assets.data, search, categoryFilter, statusFilter, locationFilter, custodianFilter, caseFilter]);

  const hasActiveFilters =
    search ||
    categoryFilter !== "all" ||
    statusFilter !== "all" ||
    locationFilter !== "all" ||
    custodianFilter !== "all" ||
    caseFilter !== "all";

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setLocationFilter("all");
    setCustodianFilter("all");
    setCaseFilter("all");
  }

  if (assets.isError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow="Law Enforcement & Custody"
          title="Police Assets & Evidence Registry"
          description="Comprehensive lifecycle management for police equipment, departmental assets, and seized criminal evidence."
        />
        <ErrorState
          title="Unable to load police assets registry"
          error={assets.error}
          onRetry={() => assets.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Law Enforcement & Custody"
        title="Police Assets & Evidence Registry"
        description="Comprehensive lifecycle management for police equipment, departmental assets, and seized criminal evidence."
        actions={
          <Button asChild className="gap-2 shadow-xs">
            <Link to="/assets/new">
              <Plus className="size-4" />
              Add Asset / Evidence
            </Link>
          </Button>
        }
      />

      {/* KPI Statistic Cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="shadow-xs border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Total Assets
              <Boxes className="size-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">In registry</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Available
              <CheckCircle2 className="size-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.available}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Ready for deployment</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Assigned / In Use
              <Shield className="size-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.assigned}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Active duty / custody</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Maintenance
              <Wrench className="size-4 text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.maintenance}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Service & calibration</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              In Transfer
              <Truck className="size-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.transfer}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Inter-station / Court</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Retired / Lost
              <XCircle className="size-4 text-destructive" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-destructive">{stats.retiredLost}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Decommissioned</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Panel */}
      <div className="mt-8 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          {/* Search bar */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name, FIR, case, custodian..."
              aria-label="Search assets and evidence by code, name, FIR, case, or custodian"
              className="pl-9"
            />
          </div>

          {/* Category Filter */}
          <div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full" aria-label="Filter assets by category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(categories.data ?? []).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full" aria-label="Filter assets by lifecycle status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="ASSIGNED_OR_IN_USE">Assigned / In Use</SelectItem>
                <SelectItem value="TRANSFERRED">In Transfer</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                <SelectItem value="REGISTERED">Registered</SelectItem>
                <SelectItem value="RETURNED">Returned</SelectItem>
                <SelectItem value="RETIRED">Retired</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location / Station Filter */}
          <div>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full" aria-label="Filter assets by storage location or police station">
                <SelectValue placeholder="Location / Station" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {uniqueLocations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc.length > 25 ? `${loc.slice(0, 25)}...` : loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Case Association Filter */}
          <div>
            <Select value={caseFilter} onValueChange={setCaseFilter}>
              <SelectTrigger className="w-full" aria-label="Filter assets by case association">
                <SelectValue placeholder="Case Association" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assets</SelectItem>
                <SelectItem value="linked">Linked to Case</SelectItem>
                <SelectItem value="unlinked">Unlinked (Departmental)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters bar */}
        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Filter className="size-3.5" />
              <span>
                Showing {filteredRows.length} of {stats.total} assets
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 px-2 text-xs gap-1"
            >
              <RotateCcw className="size-3" />
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* Assets Table */}
      <div className="mt-6 rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[180px]">Asset Code & ID</TableHead>
                <TableHead>Asset Name & Category</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[130px]">Condition</TableHead>
                <TableHead>Location & Station</TableHead>
                <TableHead>Custodian / Officer</TableHead>
                <TableHead>Related Case</TableHead>
                <TableHead className="w-[100px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
                      <ShieldAlert className="size-6 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">No assets found</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hasActiveFilters
                        ? "Try adjusting your search criteria or clearing filters."
                        : "No assets registered yet. Click 'Add Asset / Evidence' to create one."}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                        Clear all filters
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((asset) => (
                  <TableRow key={asset.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          to="/assets/$assetId"
                          params={{ assetId: asset.id }}
                          className="hover:underline text-primary flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
                        >
                          <Tag className="size-3 text-muted-foreground" />
                          {asset.asset_code}
                        </Link>
                        {Boolean(asset.evidence_status || asset.case_id || asset.fir_number) && (
                          <Badge className="bg-purple-500/15 text-purple-700 border-purple-500/30 text-[9px] px-1 py-0 h-4 dark:text-purple-300 font-sans font-semibold">
                            Evidence
                          </Badge>
                        )}
                      </div>
                      {asset.barcode_rfid && (
                        <span className="block text-[10px] text-muted-foreground font-normal">
                          {asset.barcode_rfid}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-sm text-foreground line-clamp-1">
                        {asset.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {asset.category_name || "General Asset"}
                      </div>
                    </TableCell>

                    <TableCell>{getStatusBadge(asset.status)}</TableCell>

                    <TableCell>{getConditionBadge(asset.condition)}</TableCell>

                    <TableCell>
                      <div className="text-xs font-medium text-foreground line-clamp-1">
                        {asset.current_location}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {asset.department_station}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs font-medium text-foreground">
                        {asset.current_custodian_name}
                      </div>
                      {asset.assigned_officer_name && asset.assigned_officer_name !== asset.current_custodian_name && (
                        <div className="text-[11px] text-muted-foreground">
                          Officer: {asset.assigned_officer_name}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {asset.case_number ? (
                        <div>
                          <Badge variant="outline" className="text-[11px] font-mono border-primary/30 text-primary">
                            {asset.case_number}
                          </Badge>
                          {asset.fir_number && (
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]">
                              {asset.fir_number}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unlinked</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                        <Link to="/assets/$assetId" params={{ assetId: asset.id }}>
                          View
                          <ArrowRight className="size-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
