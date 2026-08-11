import { Link, NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Bell, Building2, Download, Globe2, KeyRound, LogOut, RotateCcw, User, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { appModules, canSeeNavigationItem, moduleActiveClass, moduleForPath, moduleTitle } from "@/components/app-navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth-store";
import { authApi } from "@/lib/api/auth";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { hasAgencyContext, isPlatformAdmin } from "@/lib/platform-context";

export function AppHeader() {
  const { pathname } = useLocation();
  const { user, logout, exitAgencyContext, isSwitchingContext } = useAuthStore();
  const { canInstall, install } = usePwaInstall();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const permissions = user?.permissions ?? [];
  const activeModule = moduleForPath(pathname);
  const activeModuleTitle = moduleTitle(activeModule);
  const fullName = user?.fullName || user?.email || "Utilisateur";
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const agencyContext = hasAgencyContext(user);
  const platformAdmin = isPlatformAdmin(user);

  return (
    <header className="sticky top-0 z-20 flex min-h-16 shrink-0 items-center border-b bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/90 sm:px-4">
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:grid-cols-[auto_1fr_auto] lg:gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="-ms-1" />
          <div className="min-w-0 lg:hidden">
            <div className="truncate text-sm font-semibold">{activeModuleTitle}</div>
          </div>
        </div>

        <nav className="hidden min-w-0 items-center justify-center gap-1 overflow-x-auto lg:flex">
          {appModules
            .filter((item) => canSeeNavigationItem(item, permissions, {
              platformAdmin,
              hasAgencyContext: agencyContext,
            }))
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

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden h-9 items-center gap-2 rounded-md border bg-muted/30 px-2.5 text-xs font-medium sm:flex">
            {agencyContext ? (
              <Building2 className="size-4 text-emerald-600" />
            ) : (
              <Globe2 className="size-4 text-blue-600" />
            )}
            <span className="max-w-40 truncate">{agencyContext ? user?.agenceName : "Plateforme"}</span>
            {platformAdmin && agencyContext ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mr-1 size-6"
                disabled={isSwitchingContext}
                title="Retour à la plateforme"
                onClick={async () => {
                  try {
                    await exitAgencyContext();
                    window.location.assign("/app/platform");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Retour à la plateforme impossible");
                  }
                }}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            ) : null}
          </div>
          {canInstall ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Installer l'application"
              aria-label="Installer l'application"
              onClick={() => void install()}
            >
              <Download className="size-4" />
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="relative">
            <Bell className="size-4" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500" />
          </Button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-10 rounded-full">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-muted text-xs">
                    {initials || <User className="size-4" />}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{fullName}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {agencyContext ? user?.agenceName : "Plateforme"} · {user?.roleName ?? user?.roleCode}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/app/profile">
                  <UserRound />
                  Profil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setPasswordOpen(true); }}>
                <KeyRound />
                Changer mot de passe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void logout()}>
                <LogOut className="text-red-500" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le mot de passe</DialogTitle>
            <DialogDescription>Vous serez déconnecté après modification.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Mot de passe actuel</span>
              <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Nouveau mot de passe</span>
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>Annuler</Button>
            <Button
              disabled={savingPassword || currentPassword.length === 0 || newPassword.length < 8}
              onClick={async () => {
                setSavingPassword(true);
                try {
                  await authApi.changePassword({ currentPassword, newPassword });
                  toast.success("Mot de passe modifié");
                  setPasswordOpen(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  await logout();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Mot de passe impossible à modifier");
                } finally {
                  setSavingPassword(false);
                }
              }}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
