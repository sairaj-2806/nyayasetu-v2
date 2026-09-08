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
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff, roleLabel } from "@/hooks/use-current-staff";
import { NotificationsBell } from "@/components/notifications-bell";
import { useLanguage } from "@/lib/i18n";
import { NetworkBadge } from "@/components/network-badge";
import { GlobalSearchDialog } from "@/components/global-search-dialog";
import { switchActiveStaffPersona } from "@/lib/offline-auth";
import { ALL_ROLES, AppRole, ROLE_METADATA } from "@/lib/rbac";

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
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function handleSwitchPersona(targetRole: AppRole) {
    const acc = switchActiveStaffPersona(targetRole);
    queryClient.invalidateQueries({ queryKey: ["current-staff"] });
    toast.success("Active Staff Persona Switched", {
      description: `Now acting as ${acc.fullName} (${ROLE_METADATA[targetRole].label}). Permissions updated.`,
      icon: <UserCheck className="size-4 text-emerald-500" />,
    });
    if (targetRole === "judge") {
      navigate({ to: "/bench" });
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-13 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur-sm sm:px-5">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <BrandMark className="size-8 bg-white p-0.5 shadow-xs" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">NyayaSetu Registry</p>
          <p className="text-[11px] text-muted-foreground">AI powered court scheduling control</p>
        </div>
      </div>

      {/* Global Search Quick Launcher Button */}
      <div className="mx-2 flex-1 max-w-sm">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="group flex w-full items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/60 hover:text-foreground"
          title="Search registry (Ctrl+K or ⌘K)"
        >
          <Search className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="truncate">Search cases, exhibits, documents...</span>
          <kbd className="ml-auto hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block">
            Ctrl+K
          </kbd>
        </button>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <NetworkBadge />
        {staff?.role !== "judge" && <NotificationsBell />}

        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === "en" ? "hi" : "en")}
          className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-semibold transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
          title={lang === "en" ? "Switch to Hindi" : "Switch to English"}
        >
          <Languages className="size-3.5" />
          <span className="hidden sm:inline">{lang === "en" ? "EN | हिं" : "हिं | EN"}</span>
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

            {/* Persona switcher for RBAC evaluation */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs">
                <UserCheck className="size-3.5 mr-2 text-primary" />
                Switch Role Persona
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-60">
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                    Simulate Official Persona
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_ROLES.map((r) => {
                    const meta = ROLE_METADATA[r];
                    const isCurrent = staff?.role === r;
                    return (
                      <DropdownMenuItem
                        key={r}
                        onSelect={() => handleSwitchPersona(r)}
                        className={`text-xs ${isCurrent ? "font-semibold bg-accent text-accent-foreground" : ""}`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5">
                            {meta.label}
                            {isCurrent && <span className="text-[10px] text-primary">✓ Active</span>}
                          </span>
                          <span className="text-[10px] text-muted-foreground line-clamp-1">
                            {meta.description}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

