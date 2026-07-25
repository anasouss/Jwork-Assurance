import {
  BadgeCheck,
  Boxes,
  Calculator,
  FilePlus2,
  Files,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { NavUser } from "@/components/nav-user";
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

const navigation = [
  { title: "Tableau de bord", url: "/app", icon: LayoutDashboard, exact: true },
  { title: "Production", url: "/app/production", icon: BadgeCheck, exact: true, permission: "contrat:view" },
  { title: "Ajouter dossier", url: "/app/production/ajouter-dossier", icon: FilePlus2, permission: "contrat:create" },
  { title: "Contrats", url: "/app/production/contrats", icon: Files, permission: "contrat:view" },
  { title: "Stock attestations", url: "/app/production/attestations-stock", icon: Boxes, permission: "contrat:view" },
  { title: "Quittances", url: "/app/compta/quittances", icon: Calculator, permission: "quittance:view" },
  { title: "Paramètres production", url: "/app/production/parametres", icon: Settings, permission: "config:view" },
];

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const visibleNavigation = navigation.filter((item) => !item.permission || permissions.includes(item.permission));
  return (
    <Sidebar collapsible="icon" data-tour="sidebar" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BadgeCheck className="size-5" />
          </div>
          <div className="grid text-sm leading-tight">
            <span className="font-semibold">Assurance</span>
            <span className="text-xs text-muted-foreground">Production auto</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
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
