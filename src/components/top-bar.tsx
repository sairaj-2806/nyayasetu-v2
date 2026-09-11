import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Languages, LogOut, Search, Shield, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BrandMark } from "@/components/brand-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff, roleLabel } from "@/hooks/use-current-staff";
import { NotificationsBell } from "@/components/notifications-bell";
import { useLanguage } from "@/lib/i18n";
import { NetworkBadge } from "@/components/network-badge";
import { GlobalSearchDialog } from "@/components/global-search-dialog";
import { clearOfflineStaffSession } from "@/lib/offline-auth";
import { ROLE_METADATA } from "@/lib/rbac";
import { isDemoMode } from "@/lib/demo-mode";

export function TopBar() {
  const { data: staff } = useCurrentStaff();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lang, setLang } = useLanguage();
  const [searchOpen, setSearchOpen] = useState(false);

  const initials =
    staff?.fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "—";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    clearOfflineStaffSession();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("nyayasetu:active-role");
    }
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-20 flex h-13 items-center gap-1.5 sm:gap-2 border-b border-border bg-card/95 px-2.5 backdrop-blur-sm sm:px-5">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <BrandMark className="size-8 bg-white p-0.5 shadow-xs" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">NyayaSetu Registry</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">AI judicial platform</span>
            {staff && (
              <span className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-1.5 py-0.2 text-[9.5px] font-semibold text-primary">
                {roleLabel[staff.role]}
              </span>
            )}
            {isDemoMode() && (
              <span
                className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-600 dark:text-amber-400"
                title="Explicit DEMO_MODE active: Mock fixtures permitted"
              >
                DEMO MODE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Global Search Quick Launcher Button */}
      <div className="mx-1 sm:mx-2 flex-1 max-w-[140px] xs:max-w-[200px] sm:max-w-sm">
        <button
          type="button"
          onClick={() => navigate({ to: "/search" })}
          className="group flex w-full items-center gap-1.5 sm:gap-2 rounded-lg border border-border/70 bg-muted/30 px-2 sm:px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/60 hover:text-foreground"
          title="Search registry (Ctrl+K or ⌘K)"
        >
          <Search className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="truncate hidden sm:inline">Search cases, exhibits...</span>
          <span className="truncate sm:hidden text-[11px]">Search</span>
          <kbd
            onClick={(e) => {
              e.stopPropagation();
              setSearchOpen(true);
            }}
            className="ml-auto hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block hover:bg-muted cursor-pointer"
            title="Open quick command search"
          >
            Ctrl+K
          </kbd>
        </button>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {isDemoMode() && (
          <span
            className="md:hidden inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 shrink-0"
            title="Explicit DEMO_MODE active: Mock fixtures permitted"
          >
            DEMO
          </span>
        )}
        <NetworkBadge />
        {staff?.role !== "judge" && <NotificationsBell />}

        {/* Language toggle (English / हिन्दी) */}
        <button
          type="button"
          onClick={() => setLang(lang === "en" ? "hi" : "en")}
          className="flex items-center gap-1 rounded-md border border-border/70 bg-background/80 px-1.5 sm:px-2 py-1 text-xs font-medium transition-all hover:bg-muted hover:border-primary/40 cursor-pointer shadow-2xs shrink-0"
          title={
            lang === "en"
              ? "Switch interface to Hindi (हिन्दी में बदलें)"
              : "Switch interface to English (अंग्रेजी में बदलें)"
          }
        >
          <Languages className="size-3.5 text-primary shrink-0" />
          <span
            className={`px-1 py-0.2 rounded text-[10px] sm:text-[11px] font-semibold transition-colors ${
              lang === "en"
                ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            EN
          </span>
          <span className="text-muted-foreground/30 text-[9px]">|</span>
          <span
            className={`px-1 py-0.2 rounded text-[10px] sm:text-[11px] font-semibold transition-colors ${
              lang === "hi"
                ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            हिन्दी
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-sm px-1.5 py-1 transition-colors hover:bg-muted">
              <span className="flex size-8 items-center justify-center rounded-sm bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium text-foreground">
                  {staff?.fullName ?? "Loading…"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {staff ? roleLabel[staff.role] : ""}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium">{staff?.fullName}</span>
              <span className="block text-xs text-muted-foreground">{staff?.email}</span>
              <span className="mt-1 inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                <Shield className="size-2.5" />
                {staff ? roleLabel[staff.role] : "Staff"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handleSignOut}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="size-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
