import { NavLink, useLocation } from "react-router-dom";
import { appNavigation, canSeeNavigationItem, moduleActiveClass, moduleForPath, moduleTitle } from "@/components/app-navigation";
import skayMark from "@/assets/skay-mark.webp";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { ComponentProps } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AgencyContextSelector } from "@/components/agency-context-selector";
import { hasAgencyContext, isPlatformAdmin } from "@/lib/platform-context";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions ?? [];
  const activeModule = moduleForPath(pathname);
  const visibleNavigation = appNavigation.filter(
    (item) => item.module === activeModule && canSeeNavigationItem(item, permissions, {
      platformAdmin: isPlatformAdmin(user),
      hasAgencyContext: hasAgencyContext(user),
    })
  );

  return (
    <Sidebar collapsible="icon" data-tour="sidebar" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/70">
        <div className="flex min-h-14 items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <img src={skayMark} alt="Skay Assurance" className="size-9 shrink-0 object-contain" />
          <span className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">Skay Assurance</span>
            <span className="truncate text-xs text-muted-foreground">Plateforme agence</span>
          </span>
        </div>
        <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
          <div className="text-xs font-medium uppercase text-muted-foreground">Module</div>
          <div className={`mt-1 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${moduleActiveClass(activeModule)}`}>
            {moduleTitle(activeModule)}
          </div>
        </div>
        <div className="px-2 pb-2 group-data-[collapsible=icon]:px-0">
          <AgencyContextSelector />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {visibleNavigation.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <NavLink
                    to={item.url}
                    end={item.exact}
                    className={({ isActive }) => (isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "")}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
