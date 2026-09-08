import { useEffect, useState, useTransition } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
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

const ENTITY_STYLE: Record<SearchEntityType, { text: string; bg: string }> = {
  case: { text: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/15" },
  document: { text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/15" },
  document_version: { text: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/15" },
  police_asset: { text: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/15" },
  evidence: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15" },
  officer_custodian: { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/15" },
  location: { text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/15" },
  audit_event: { text: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/15" },
};

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: staff } = useCurrentStaff();
  const searchFn = useServerFn(searchGlobalRegistry);

  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<SearchEntityType | "all">("all");
  const [results, setResults] = useState<UnifiedSearchResult | null>(null);
  const [isSearching, startSearchTransition] = useTransition();

  // Close immediately on route changes so users are never trapped
  useEffect(() => {
    if (open) {
      onOpenChange(false);
    }
  }, [pathname, open, onOpenChange]);

  // Ensure scroll lock and pointer-events lock are cleared whenever dialog closes
  useEffect(() => {
    if (!open && typeof document !== "undefined") {
      document.body.style.pointerEvents = "";
      document.body.removeAttribute("data-scroll-locked");
    }
  }, [open]);

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

  function renderGroup(heading: string, groupItems: SearchResultItem[], type: SearchEntityType) {
    if (groupItems.length === 0) return null;
    const Icon = ENTITY_ICONS[type];
    const style = ENTITY_STYLE[type];
    return (
      <CommandGroup heading={heading}>
        {groupItems.slice(0, 4).map((item) => (
          <CommandItem
            key={item.id}
            value={`${item.title} ${item.subtitle} ${item.caseNumber || ""} ${item.description || ""}`}
            onSelect={() => handleSelect(item)}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-accent/60 my-0.5"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className={`size-7 rounded-md ${style.bg} flex items-center justify-center shrink-0`}
              >
                <Icon className={`size-3.5 ${style.text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-xs text-foreground truncate">{item.title}</p>
                  {item.caseNumber && (
                    <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline truncate">
                      {item.caseNumber}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
              </div>
            </div>
            {item.status && (
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 font-mono ${item.statusBadgeClass || ""}`}
              >
                {item.status}
              </Badge>
            )}
          </CommandItem>
        ))}
      </CommandGroup>
    );
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col border-b border-border bg-card/60">
        <div className="flex items-center pr-14 pl-1">
          <div className="flex-1 min-w-0">
            <CommandInput
              placeholder="Search cases, CNR, documents, versions, evidence EV-1045, assets, officers..."
              value={query}
              onValueChange={setQuery}
              wrapperClassName="border-b-0 px-3.5"
              className="text-sm font-medium h-12"
            />
          </div>
          <Badge
            variant="outline"
            className="text-[10px] uppercase font-mono tracking-wider shrink-0 bg-muted/60 text-muted-foreground mr-1"
          >
            RLS Active
          </Badge>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 border-t border-border/50 no-scrollbar text-xs bg-muted/20">
          <button
            type="button"
            onClick={() => setActiveType("all")}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors shrink-0 ${
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

      <CommandList className="max-h-[380px] p-2 overflow-y-auto">
        {items.length === 0 && (
          <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
            No authorized records match &ldquo;{query}&rdquo;. Try searching for
            &ldquo;BNS/2026/0014&rdquo;, &ldquo;EV-1045&rdquo;, &ldquo;forensic report&rdquo;, or
            &ldquo;mobile phone&rdquo;.
          </CommandEmpty>
        )}

        {renderGroup(`Cases (${groupedItems.case.length})`, groupedItems.case, "case")}
        {renderGroup(
          `Documents (${groupedItems.document.length})`,
          groupedItems.document,
          "document",
        )}
        {renderGroup(
          `Evidence Exhibits (${groupedItems.evidence.length})`,
          groupedItems.evidence,
          "evidence",
        )}
        {renderGroup(
          `Police Assets (${groupedItems.police_asset.length})`,
          groupedItems.police_asset,
          "police_asset",
        )}
        {renderGroup(
          `Document Versions (${groupedItems.document_version.length})`,
          groupedItems.document_version,
          "document_version",
        )}
        {renderGroup(
          `Officers & Custodians (${groupedItems.officer_custodian.length})`,
          groupedItems.officer_custodian,
          "officer_custodian",
        )}
        {renderGroup(
          `Locations & Malkhanas (${groupedItems.location.length})`,
          groupedItems.location,
          "location",
        )}
        {renderGroup(
          `Audit Events (${groupedItems.audit_event.length})`,
          groupedItems.audit_event,
          "audit_event",
        )}
      </CommandList>

      <div className="flex items-center justify-between border-t border-border bg-card/80 px-4 py-2.5 text-xs text-muted-foreground">
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
