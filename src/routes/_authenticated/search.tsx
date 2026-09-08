import { useMemo, useState, useTransition, useEffect } from "react";
import { createFileRoute, useNavigate, useLocation, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Archive,
  Building2,
  Calendar,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Gavel,
  History,
  Layers,
  Lock,
  MapPin,
  Package,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
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
import { useCurrentStaff } from "@/hooks/use-current-staff";
import {
  executeUnifiedSearch,
  KNOWN_LOCATIONS,
  type SearchEntityType,
  type SearchFilters,
  type SearchResultItem,
  type UnifiedSearchResult,
} from "@/lib/global-search";
import { searchGlobalRegistry } from "@/lib/global-search.functions";
import { DOCUMENT_CATEGORIES } from "@/lib/documents";
import { DEFAULT_ASSET_CATEGORIES } from "@/lib/assets";
import { cn } from "@/lib/utils";

const ASSET_CATEGORIES = DEFAULT_ASSET_CATEGORIES.map((c) => c.name);

const QUICK_PRESETS = [
  { label: "BNS/2026/0014", query: "BNS/2026/0014", desc: "Case + Docs + Evidence + Assets" },
  { label: "forensic report", query: "forensic report", desc: "CFSL & Ballistic Certificates" },
  { label: "EV-1045", query: "EV-1045", desc: "Exhibit + Custody + Chain" },
  { label: "mobile phone", query: "mobile phone", desc: "Digital Evidence & Hardware" },
  { label: "under maintenance", query: "MAINTENANCE", desc: "Assets in Service" },
  { label: "Central Malkhana", query: "Central Malkhana", desc: "Secure Vault Inventory" },
];

const ENTITY_TABS: { id: SearchEntityType | "all"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "All Records", icon: Layers },
  { id: "case", label: "Cases", icon: Scale },
  { id: "document", label: "Documents", icon: FileText },
  { id: "evidence", label: "Evidence", icon: Tag },
  { id: "police_asset", label: "Assets", icon: Shield },
  { id: "document_version", label: "Versions", icon: History },
  { id: "officer_custodian", label: "Custodians", icon: Users },
  { id: "location", label: "Locations", icon: Building2 },
  { id: "audit_event", label: "Audit Logs", icon: Activity },
];

function getEntityIcon(type: SearchEntityType) {
  switch (type) {
    case "case":
      return <Scale className="size-4 text-sky-600 dark:text-sky-400" />;
    case "document":
      return <FileText className="size-4 text-blue-600 dark:text-blue-400" />;
    case "document_version":
      return <History className="size-4 text-purple-600 dark:text-purple-400" />;
    case "police_asset":
      return <Shield className="size-4 text-indigo-600 dark:text-indigo-400" />;
    case "evidence":
      return <Tag className="size-4 text-emerald-600 dark:text-emerald-400" />;
    case "officer_custodian":
      return <Users className="size-4 text-amber-600 dark:text-amber-400" />;
    case "location":
      return <Building2 className="size-4 text-orange-600 dark:text-orange-400" />;
    case "audit_event":
      return <Activity className="size-4 text-rose-600 dark:text-rose-400" />;
  }
}

function getEntityBadge(type: SearchEntityType) {
  switch (type) {
    case "case":
      return <Badge className="bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300">Case</Badge>;
    case "document":
      return <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300">Document</Badge>;
    case "document_version":
      return <Badge className="bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300">Version</Badge>;
    case "police_asset":
      return <Badge className="bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-300">Police Asset</Badge>;
    case "evidence":
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300">Evidence Exhibit</Badge>;
    case "officer_custodian":
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300">Custodian</Badge>;
    case "location":
      return <Badge className="bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-300">Facility / Vault</Badge>;
    case "audit_event":
      return <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300">Audit Trail</Badge>;
  }
}

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "Unified Global Registry Search — NyayaSetu" },
      {
        name: "description",
        content:
          "Fast authorized cross-domain search across Court Cases, Evidence Exhibits, Police Assets, Secure Documents, Versions, Custodians and Audit Records.",
      },
    ],
  }),
  component: UnifiedGlobalSearchPage,
});

export function UnifiedGlobalSearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: staff } = useCurrentStaff();
  const searchFn = useServerFn(searchGlobalRegistry);

  // Extract initial search parameters from URL
  const rawSearch = (location.search || {}) as Record<string, unknown>;
  const initialQ = typeof rawSearch["q"] === "string" ? rawSearch["q"] : "";
  const initialType = typeof rawSearch["type"] === "string" ? (rawSearch["type"] as SearchEntityType | "all") : "all";
  const initialCase = typeof rawSearch["case"] === "string" ? rawSearch["case"] : "";
  const initialDocType = typeof rawSearch["docType"] === "string" ? rawSearch["docType"] : "all";
  const initialAssetType = typeof rawSearch["assetType"] === "string" ? rawSearch["assetType"] : "all";
  const initialStatus = typeof rawSearch["status"] === "string" ? rawSearch["status"] : "all";
  const initialLocation = typeof rawSearch["location"] === "string" ? rawSearch["location"] : "all";
  const initialStartDate = typeof rawSearch["startDate"] === "string" ? rawSearch["startDate"] : "";
  const initialEndDate = typeof rawSearch["endDate"] === "string" ? rawSearch["endDate"] : "";

  const [inputQuery, setInputQuery] = useState(initialQ);
  const [activeTab, setActiveTab] = useState<SearchEntityType | "all">(initialType);
  const [caseFilter, setCaseFilter] = useState<string>(initialCase);
  const [docTypeFilter, setDocTypeFilter] = useState<string>(initialDocType);
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>(initialAssetType);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [locationFilter, setLocationFilter] = useState<string>(initialLocation);
  const [startDateFilter, setStartDateFilter] = useState<string>(initialStartDate);
  const [endDateFilter, setEndDateFilter] = useState<string>(initialEndDate);
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<UnifiedSearchResult | null>(null);
  const [isSearching, startSearchTransition] = useTransition();

  // Execute Search
  const doSearch = (overrideQuery?: string, overrideTab?: SearchEntityType | "all") => {
    const q = overrideQuery !== undefined ? overrideQuery : inputQuery;
    const tab = overrideTab !== undefined ? overrideTab : activeTab;

    const filters: SearchFilters = {
      entityType: tab === "all" ? undefined : tab,
      caseNumber: caseFilter.trim() ? caseFilter.trim() : undefined,
      documentType: docTypeFilter === "all" ? undefined : docTypeFilter,
      assetType: assetTypeFilter === "all" ? undefined : assetTypeFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      location: locationFilter === "all" ? undefined : locationFilter,
      startDate: startDateFilter.trim() ? startDateFilter.trim() : undefined,
      endDate: endDateFilter.trim() ? endDateFilter.trim() : undefined,
    };

    startSearchTransition(async () => {
      try {
        const res = await searchFn({
          data: {
            query: q,
            filters,
            userRole: staff?.role,
            userId: staff?.id,
          },
        });
        setResults(res as UnifiedSearchResult);
      } catch {
        // Direct client fallback
        const clientRes = await executeUnifiedSearch({
          query: q,
          filters,
          userRole: staff?.role,
          userId: staff?.id,
        });
        setResults(clientRes);
      }
    });

    // Update query params in URL
    navigate({
      to: "/search" as any,
      search: {
        q: q.trim() ? q.trim() : undefined,
        type: tab === "all" ? undefined : tab,
        case: caseFilter.trim() ? caseFilter.trim() : undefined,
        docType: docTypeFilter === "all" ? undefined : docTypeFilter,
        assetType: assetTypeFilter === "all" ? undefined : assetTypeFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        location: locationFilter === "all" ? undefined : locationFilter,
        startDate: startDateFilter.trim() ? startDateFilter.trim() : undefined,
        endDate: endDateFilter.trim() ? endDateFilter.trim() : undefined,
      } as any,
      replace: true,
    });
  };

  // Trigger search on initial load or parameter change
  useEffect(() => {
    doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, docTypeFilter, assetTypeFilter, statusFilter, locationFilter]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      doSearch();
    }
  };

  const handleResetFilters = () => {
    setCaseFilter("");
    setDocTypeFilter("all");
    setAssetTypeFilter("all");
    setStatusFilter("all");
    setLocationFilter("all");
    setStartDateFilter("");
    setEndDateFilter("");
    setActiveTab("all");
  };

  const hasActiveFilters =
    caseFilter ||
    docTypeFilter !== "all" ||
    assetTypeFilter !== "all" ||
    statusFilter !== "all" ||
    locationFilter !== "all" ||
    startDateFilter ||
    endDateFilter;

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Unified Global Registry Search"
        description="Authorized multi-entity cross-domain search across Court Cases, Pleadings, Evidence Exhibits, Police Assets, Custodians and Audit Records."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:text-emerald-400">
              <ShieldCheck className="size-3.5" />
              Supabase RLS Enforced
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-muted text-muted-foreground border">
              Role: {staff?.role ?? "Court Staff"}
            </span>
          </div>
        }
      />

      {/* Main Search Bar Card */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
              <Input
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search case numbers, exhibit IDs, serials, document titles, officers, or keywords (e.g. BNS/2026/0014, EV-1045, forensic report, mobile phone)..."
                className="pl-11 pr-10 h-12 text-base rounded-lg border-border focus-visible:ring-primary/20"
                autoFocus
              />
              {inputQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setInputQuery("");
                    doSearch("");
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => doSearch()}
                disabled={isSearching}
                className="h-12 px-6 gap-2 text-sm font-semibold shadow-sm"
              >
                {isSearching ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Search Registry
              </Button>
              <Button
                variant={showFilters || hasActiveFilters ? "secondary" : "outline"}
                onClick={() => setShowFilters((prev) => !prev)}
                className="h-12 px-4 gap-2 text-sm"
              >
                <Filter className="size-4" />
                Filters
                {hasActiveFilters && (
                  <span className="size-2 rounded-full bg-primary" />
                )}
              </Button>
            </div>
          </div>

          {/* Quick Preset Queries */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-muted-foreground font-medium mr-1">Quick lookups:</span>
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setInputQuery(preset.query);
                  doSearch(preset.query);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/70 hover:bg-muted text-foreground border border-border/70 hover:border-border transition-colors font-mono text-[11px]"
                title={preset.desc}
              >
                <span>{preset.label}</span>
                <span className="text-[10px] text-muted-foreground font-sans hidden sm:inline">
                  • {preset.desc}
                </span>
              </button>
            ))}
          </div>

          {/* Collapsible Advanced Filters Drawer */}
          {showFilters && (
            <div className="pt-4 border-t mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs animate-in fade-in duration-200">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Case Filter</Label>
                <Input
                  value={caseFilter}
                  onChange={(e) => setCaseFilter(e.target.value)}
                  placeholder="e.g. BNS/2026/0014"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Document Type</Label>
                <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Document Types</SelectItem>
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Asset Category</Label>
                <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Asset Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Asset Types</SelectItem>
                    {ASSET_CATEGORIES.map((categoryName: string) => (
                      <SelectItem key={categoryName} value={categoryName}>
                        {categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="AVAILABLE">AVAILABLE</SelectItem>
                    <SelectItem value="ASSIGNED">ASSIGNED</SelectItem>
                    <SelectItem value="IN_USE">IN_USE</SelectItem>
                    <SelectItem value="MAINTENANCE">MAINTENANCE</SelectItem>
                    <SelectItem value="TRANSFERRED">TRANSFERRED</SelectItem>
                    <SelectItem value="RETURNED">RETURNED</SelectItem>
                    <SelectItem value="STORED">STORED (Evidence)</SelectItem>
                    <SelectItem value="scheduled">Scheduled (Case)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Location</Label>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Facilities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {KNOWN_LOCATIONS.map((loc) => (
                      <SelectItem key={loc.id} value={loc.name}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 flex flex-col justify-end">
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResetFilters}
                    disabled={!hasActiveFilters}
                    className="h-8 text-xs flex-1 gap-1"
                  >
                    <RotateCcw className="size-3" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => doSearch()}
                    className="h-8 text-xs flex-1"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entity Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b text-sm scrollbar-none">
        {ENTITY_TABS.map((tab) => {
          const Icon = tab.icon;
          const count =
            tab.id === "all"
              ? results?.totalMatches ?? 0
              : results?.byEntityCount[tab.id] ?? 0;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                doSearch(undefined, tab.id);
              }}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md border transition-all whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
              )}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Performance & Security Clearance Meta Bar */}
      {results && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/40 px-4 py-2.5 rounded-lg border">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {results.totalMatches} {results.totalMatches === 1 ? "match" : "matches"}
            </span>
            <span>found across authorized registries in</span>
            <span className="font-mono text-foreground font-semibold">
              {results.executionTimeMs}ms
            </span>
            {results.query && (
              <span className="hidden sm:inline">
                for query <span className="font-mono text-foreground">"{results.query}"</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <Database className="size-3.5" />
              <span>Indexed DB + Memory Engine</span>
            </div>
            {results.filteredOutCount > 0 && (
              <div
                className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"
                title="Sealed cover in-camera or classified records concealed by RLS policy"
              >
                <Lock className="size-3.5" />
                <span>{results.filteredOutCount} restricted items masked by RLS</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result Cards Display */}
      {results && results.items.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {results.items.map((item) => (
            <Card
              key={item.id}
              className="border-border hover:border-primary/40 transition-colors shadow-xs group"
            >
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {getEntityBadge(item.entityType)}
                    <h3 className="text-base font-semibold text-foreground tracking-tight hover:underline cursor-pointer">
                      <Link to={item.route as any} params={item.routeParams as any}>
                        {item.title}
                      </Link>
                    </h3>
                    {item.status && (
                      <Badge
                        variant="outline"
                        className={cn("text-[11px] font-mono", item.statusBadgeClass)}
                      >
                        {item.status}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs font-medium text-muted-foreground">{item.subtitle}</p>

                  <p className="text-xs text-muted-foreground/90 line-clamp-2">
                    {item.description}
                  </p>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                    {item.caseNumber && (
                      <span className="inline-flex items-center gap-1 font-mono text-primary font-medium">
                        <Scale className="size-3" />
                        {item.caseNumber}
                      </span>
                    )}

                    {item.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {item.location}
                      </span>
                    )}

                    {item.officerOrCustodian && (
                      <span className="inline-flex items-center gap-1">
                        <UserCheck className="size-3" />
                        {item.officerOrCustodian}
                      </span>
                    )}

                    {item.date && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" />
                        {item.date}
                      </span>
                    )}
                  </div>
                </div>

                {/* Direct Action Link */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="gap-1.5 text-xs font-semibold group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"
                  >
                    <Link to={item.route as any} params={item.routeParams as any}>
                      <span>Open Record</span>
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Score: {item.relevanceScore}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : results && results.items.length === 0 ? (
        <Card className="border-border p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Search className="size-6" />
            </div>
            <h3 className="text-lg font-semibold">No authorized records matched your query</h3>
            <p className="text-xs text-muted-foreground">
              No results found for{" "}
              <span className="font-mono text-foreground">"{results.query}"</span> within the
              selected filters and your security authorization level.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="outline" onClick={handleResetFilters}>
                Clear All Filters
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setInputQuery("BNS/2026/0014");
                  doSearch("BNS/2026/0014");
                }}
              >
                Search Example Case
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-8 text-center border-dashed">
            <div className="flex flex-col items-center justify-center space-y-2">
              <Search className="size-8 text-muted-foreground animate-pulse" />
              <p className="text-sm font-medium">Loading search results...</p>
            </div>
          </Card>
        </div>
      )}

      {/* Public CNR Search Preserved Callout */}
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Public CNR / Case Status Search Preserved
            </span>
            <p className="text-muted-foreground">
              Litigants and advocates looking for unauthenticated public cause lists and CNR status
              can continue to use the public portal.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild className="shrink-0 text-xs">
            <Link to="/case-status">Go to Public CNR Search</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
