import { NavLink, useLocation } from "react-router-dom";
import { NavUser } from "@/components/nav-user";
import { appNavigation, moduleActiveClass, moduleForPath, moduleTitle } from "@/components/app-navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const activeModule = moduleForPath(pathname);
  const visibleNavigation = appNavigation.filter(
    (item) => item.module === activeModule && (!item.permission || permissions.includes(item.permission))
  );

  return (
    <Sidebar collapsible="icon" data-tour="sidebar" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/70">
        <div className="grid min-h-12 px-2 py-2 leading-tight group-data-[collapsible=icon]:place-items-center group-data-[collapsible=icon]:px-0">
          <span className="text-xs font-medium uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">Module</span>
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">{moduleTitle(activeModule)}</span>
          <span className={`hidden size-8 items-center justify-center rounded-md text-xs font-semibold group-data-[collapsible=icon]:flex ${moduleActiveClass(activeModule)}`}>
            {moduleTitle(activeModule).slice(0, 1)}
          </span>
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
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
