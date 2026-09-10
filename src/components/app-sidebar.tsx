import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

import { BrandMark } from "@/components/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { benchNavSections, getNavSectionsForRole, navSections } from "@/lib/nav";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { ROLE_METADATA } from "@/lib/rbac";

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const staff = useCurrentStaff();
  const { t } = useLanguage();
  const isAdmin = staff.data?.role === "admin";
  const role = staff.data?.role || "unassigned";
  const roleInfo = ROLE_METADATA[role];

  const sectionLabelKey: Record<string, TranslationKey> = {
    Overview: "nav.overview",
    Scheduling: "nav.scheduling",
    Administration: "nav.administration",
    "Court Operations": "nav.scheduling",
    "Secure Vault": "nav.documents",
    "Investigation & Evidence": "nav.evidence",
    "Police Assets": "nav.assets",
    "Evidence & Custody": "nav.evidence",
    "Investigation & Documents": "nav.documents",
    "Forensic Records": "nav.documents",
    "Malkhana Vault": "nav.evidence",
    "Custody Records": "nav.documents",
    "Legal Vault": "nav.documents",
    "My bench": "nav.overview",
  };

  const routeTitleKey: Record<string, TranslationKey> = {
    "/dashboard": "nav.dashboard",
    "/search": "nav.search",
    "/cases": "nav.cases",
    "/documents": "nav.documents",
    "/assets": "nav.assets",
    "/evidence": "nav.evidence",
    "/judges": "nav.judges",
    "/courtrooms": "nav.courtrooms",
    "/calendar": "nav.calendar",
    "/cause-list": "nav.cause-list",
    "/smart-scheduling": "nav.smart-scheduling",
    "/conflicts": "nav.conflicts",
    "/what-if-simulation": "nav.what-if",
    "/backlog-simulator": "nav.backlog",
    "/reports": "nav.reports",
    "/activity-log": "nav.activity-log",
    "/governance": "nav.governance",
    "/admin": "nav.admin",
    "/priority-settings": "nav.priority-settings",
    "/bench": "nav.bench",
    "/case-status": "nav.case-status",
    "/ai-assistant": "nav.ai-assistant",
  };

  const sections = getNavSectionsForRole(staff.data?.role)
    .map((section) => ({ ...section, items: section.items.filter((i) => !i.adminOnly || isAdmin) }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div
          className={cn(
            "flex items-center py-2.5",
            collapsed ? "justify-center px-0" : "gap-3 px-1",
          )}
        >
          <BrandMark
            className={cn(
              "bg-white p-0.5 transition-all duration-200 ring-1 ring-border/20 shadow-xs",
              collapsed ? "size-8" : "size-10",
            )}
            showLabel
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">NyayaSetu</p>
              <p className="truncate text-[11px] tracking-wide text-sidebar-primary font-medium">
                {roleInfo?.label || "Court Registry"}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label} className="py-2.5">
            <SidebarGroupLabel className="text-[11px] tracking-[0.1em] text-sidebar-foreground/50 uppercase">
              {sectionLabelKey[section.label]
                ? t(sectionLabelKey[section.label] as TranslationKey)
                : section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.to}>
                      <Link
                        to={item.to}
                        className="flex items-center gap-2"
                        onClick={() => {
                          if (isMobile) {
                            setOpenMobile(false);
                          }
                        }}
                      >
                        <item.icon className="size-4" />
                        <span>
                          {routeTitleKey[item.to]
                            ? t(routeTitleKey[item.to] as TranslationKey)
                            : item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-2 py-1 text-[11px] text-sidebar-foreground/80 flex items-center justify-between">
            <span className="truncate">{roleInfo?.label || "National Justice Core"}</span>
            <span className="font-mono text-[10px] text-sidebar-primary font-semibold">BSA §63</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
