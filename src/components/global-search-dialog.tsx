import { useEffect, useState, useTransition } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  Folder,
  FileText,
  ShieldAlert,
  Fingerprint,
  UserCheck,
  MapPin,
  History,
  FileCode,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Sparkles,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { searchGlobalRegistry } from "@/lib/global-search.functions";
import {
  type SearchEntityType,
  type SearchResultItem,
  type UnifiedSearchResult,
  executeUnifiedSearch,
} from "@/lib/global-search";

const ENTITY_ICONS: Record<SearchEntityType, React.ElementType> = {
  case: Folder,
  document: FileText,
  document_version: FileCode,
  police_asset: ShieldAlert,
  evidence: Fingerprint,
  officer_custodian: UserCheck,
  location: MapPin,
  audit_event: History,
};

const ENTITY_LABELS: Record<SearchEntityType, string> = {
  case: "Cases",
  document: "Documents",
  document_version: "Versions",
  police_asset: "Police Assets",
  evidence: "Evidence Exhibits",
  officer_custodian: "Officers & Custodians",
  location: "Locations & Malkhanas",
  audit_event: "Audit Events",
};

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: staff } = useCurrentStaff();
  const searchFn = useServerFn(searchGlobalRegistry);

  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<SearchEntityType | "all">("all");
  const [results, setResults] = useState<UnifiedSearchResult | null>(null);
  const [isSearching, startSearchTransition] = useTransition();

  // Keyboard shortcut listener: Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // Execute search when query or activeType changes
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    startSearchTransition(async () => {
      try {
        const res = await searchFn({
          data: {
            query,
            filters: {
              entityType: activeType === "all" ? undefined : activeType,
            },
            userRole: staff?.role,
            userId: staff?.id,
          },
        });
        if (isMounted) {
          setResults(res as UnifiedSearchResult);
        }
      } catch {
        // Fallback to client execution if server call fails
        const clientRes = await executeUnifiedSearch({
          query,
          filters: { entityType: activeType === "all" ? undefined : activeType },
          userRole: staff?.role,
          userId: staff?.id,
        });
        if (isMounted) {
          setResults(clientRes);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [query, activeType, open, staff?.role, staff?.id, searchFn]);

  function handleSelect(item: SearchResultItem) {
    onOpenChange(false);
    const caseId = item.routeParams?.["caseId"];
    const documentId = item.routeParams?.["documentId"];
    const assetId = item.routeParams?.["assetId"];

    if (item.route === "/cases/$caseId" && caseId) {
      navigate({ to: "/cases/$caseId", params: { caseId } });
    } else if (item.route === "/documents/$documentId" && documentId) {
      navigate({ to: "/documents/$documentId", params: { documentId } });
    } else if (item.route === "/assets/$assetId" && assetId) {
      navigate({ to: "/assets/$assetId", params: { assetId } });
    } else {
      navigate({ to: item.route as any });
    }
  }

  function handleGoToFullSearch() {
    onOpenChange(false);
    navigate({
      to: "/search" as any,
      search: {
        q: query || undefined,
        type: activeType === "all" ? undefined : activeType,
      } as any,
    });
  }

  const items = results?.items ?? [];

  // Group items by entityType
  const groupedItems = items.reduce<Record<SearchEntityType, SearchResultItem[]>>(
    (acc, item) => {
      if (!acc[item.entityType]) acc[item.entityType] = [];
      acc[item.entityType].push(item);
      return acc;
    },
    {
      case: [],
      document: [],
      document_version: [],
      police_asset: [],
      evidence: [],
      officer_custodian: [],
      location: [],
      audit_event: [],
    },
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col border-b border-border bg-card/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <CommandInput
            placeholder="Search cases, CNR, documents, versions, evidence EV-1045, assets, officers..."
            value={query}
            onValueChange={setQuery}
            className="text-sm font-medium"
          />
          <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider shrink-0">
            RLS Active
          </Badge>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setActiveType("all")}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              activeType === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({results?.totalMatches ?? 0})
          </button>
          {(Object.keys(ENTITY_LABELS) as SearchEntityType[]).map((type) => {
            const count = results?.byEntityCount[type] ?? 0;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors shrink-0 ${
                  activeType === type
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {ENTITY_LABELS[type]} {count > 0 ? `(${count})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      <CommandList className="max-h-[380px] p-2">
        {items.length === 0 && (
          <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
            No authorized records match &ldquo;{query}&rdquo;. Try searching for &ldquo;BNS/2026/0014&rdquo;, &ldquo;EV-1045&rdquo;, &ldquo;forensic report&rdquo;, or &ldquo;mobile phone&rdquo;.
          </CommandEmpty>
        )}

        {/* Cases Group */}
        {groupedItems.case.length > 0 && (
          <CommandGroup heading={`Cases (${groupedItems.case.length})`}>
            {groupedItems.case.slice(0, 4).map((item) => {
              const Icon = ENTITY_ICONS.case;
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.subtitle} ${item.caseNumber}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-start justify-between gap-3 py-2 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className="size-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.status && (
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${item.statusBadgeClass}`}>
                      {item.status}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Documents Group */}
        {groupedItems.document.length > 0 && (
          <CommandGroup heading={`Documents (${groupedItems.document.length})`}>
            {groupedItems.document.slice(0, 4).map((item) => {
              const Icon = ENTITY_ICONS.document;
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.subtitle} ${item.description}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-start justify-between gap-3 py-2 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className="size-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.status && (
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${item.statusBadgeClass}`}>
                      {item.status}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Evidence Exhibits Group */}
        {groupedItems.evidence.length > 0 && (
          <CommandGroup heading={`Evidence Exhibits (${groupedItems.evidence.length})`}>
            {groupedItems.evidence.slice(0, 4).map((item) => {
              const Icon = ENTITY_ICONS.evidence;
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.subtitle} ${item.description}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-start justify-between gap-3 py-2 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.status && (
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${item.statusBadgeClass}`}>
                      {item.status}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Police Assets Group */}
        {groupedItems.police_asset.length > 0 && (
          <CommandGroup heading={`Police Assets (${groupedItems.police_asset.length})`}>
            {groupedItems.police_asset.slice(0, 4).map((item) => {
              const Icon = ENTITY_ICONS.police_asset;
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.subtitle} ${item.description}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-start justify-between gap-3 py-2 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.status && (
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${item.statusBadgeClass}`}>
                      {item.status}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Document Versions Group */}
        {groupedItems.document_version.length > 0 && (
          <CommandGroup heading={`Document Versions (${groupedItems.document_version.length})`}>
            {groupedItems.document_version.slice(0, 3).map((item) => {
              const Icon = ENTITY_ICONS.document_version;
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.subtitle} ${item.description}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-start justify-between gap-3 py-2 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className="size-4 text-violet-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.status && (
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${item.statusBadgeClass}`}>
                      {item.status}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Officers & Custodians Group */}
        {groupedItems.officer_custodian.length > 0 && (
          <CommandGroup heading={`Officers & Custodians (${groupedItems.officer_custodian.length})`}>
            {groupedItems.officer_custodian.slice(0, 3).map((item) => {
              const Icon = ENTITY_ICONS.officer_custodian;
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.subtitle} ${item.description}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-start justify-between gap-3 py-2 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className="size-4 text-cyan-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.status && (
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${item.statusBadgeClass}`}>
                      {item.status}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Locations Group */}
        {groupedItems.location.length > 0 && (
          <CommandGroup heading={`Locations & Malkhanas (${groupedItems.location.length})`}>
            {groupedItems.location.slice(0, 3).map((item) => {
              const Icon = ENTITY_ICONS.location;
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.subtitle} ${item.description}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-start justify-between gap-3 py-2 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className="size-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.status && (
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${item.statusBadgeClass}`}>
                      {item.status}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Audit Events Group */}
        {groupedItems.audit_event.length > 0 && (
          <CommandGroup heading={`Audit Events (${groupedItems.audit_event.length})`}>
            {groupedItems.audit_event.slice(0, 3).map((item) => {
              const Icon = ENTITY_ICONS.audit_event;
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.subtitle} ${item.description}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-start justify-between gap-3 py-2 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className="size-4 text-teal-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.status && (
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${item.statusBadgeClass}`}>
                      {item.status}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>

      <div className="flex items-center justify-between border-t border-border bg-card/80 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>
            {results?.totalMatches ?? 0} matches in {results?.executionTimeMs ?? 0}ms
          </span>
          {results && results.filteredOutCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Lock className="size-3" />
              {results.filteredOutCount} restricted items masked
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleGoToFullSearch}
          className="flex items-center gap-1 text-primary hover:underline font-medium cursor-pointer"
        >
          View all in full search <ArrowRight className="size-3" />
        </button>
      </div>
    </CommandDialog>
  );
}
