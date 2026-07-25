import { Link, NavLink, useLocation } from "react-router-dom";
import { BadgeCheck, Bell, FilePlus2, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { appModules, moduleActiveClass, moduleForPath } from "@/components/app-navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth-store";

export function AppHeader() {
  const { pathname } = useLocation();
  const { user, logout } = useAuthStore();
  const canCreateContrat = user?.permissions?.includes("contrat:create") ?? false;
  const permissions = user?.permissions ?? [];
  const activeModule = moduleForPath(pathname);
  const fullName = user?.fullName || user?.email || "Utilisateur";
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex min-h-16 shrink-0 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex w-full min-w-0 items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ms-1" />
          <Link to="/app" className="flex min-w-0 items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BadgeCheck className="size-5" />
            </span>
            <span className="hidden min-w-0 leading-tight sm:grid">
              <span className="truncate text-sm font-semibold">Assurance</span>
              <span className="truncate text-xs text-muted-foreground">Plateforme agence</span>
            </span>
          </Link>
        </div>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {appModules
          .filter((item) => !item.permission || permissions.includes(item.permission))
          .map((item) => {
            if (item.disabled) {
              return (
                <button
                  key={item.url}
                  type="button"
                  disabled
                    className="flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground/45"
                >
                  <item.icon className="size-4" />
                  {item.title}
                </button>
              );
            }

            const itemModule = moduleForPath(item.url);
            const isActive = activeModule === itemModule;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={[
                    "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  isActive ? moduleActiveClass(itemModule) : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <item.icon className="size-4" />
                {item.title}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {canCreateContrat ? (
            <Button asChild size="sm">
              <Link to="/app/production/ajouter-dossier">
                <FilePlus2 className="size-4" />
                Ajouter dossier
              </Link>
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="relative">
            <Bell className="size-4" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500" />
          </Button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" className="h-10 gap-2 px-2">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-muted text-xs">
                    {initials || <User className="size-4" />}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-left leading-tight lg:grid">
                  <span className="text-sm font-medium">{user?.agenceName ?? "Agence"}</span>
                  <span className="text-xs text-muted-foreground">{user?.roleName ?? user?.roleCode}</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{fullName}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()}>
                <LogOut className="text-red-500" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
