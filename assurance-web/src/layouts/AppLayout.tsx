import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/app-header";
import { moduleForPath, routeRequiresAgencyContext } from "@/components/app-navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { AccessDenied, LoadingPage } from "@/components/shared";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { hasAnyPermission, permissionRequirementForPath } from "@/lib/authorization";
import { useAuthStore } from "@/store/auth-store";
import { hasAgencyContext, isPlatformAdmin } from "@/lib/platform-context";

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hydrate, isAuthenticated, isHydrated, user } = useAuthStore();
  const activeModule = moduleForPath(location.pathname);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, isHydrated, navigate]);

  if (!isHydrated) {
    return <LoadingPage message="Chargement de la session" />;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const permissionRequirement = permissionRequirementForPath(location.pathname);
  const canAccessRoute =
    !permissionRequirement ||
    hasAnyPermission(user.permissions ?? [], permissionRequirement.anyOf);
  const agencyContextMissing = routeRequiresAgencyContext(location.pathname) && !hasAgencyContext(user);
  const platformRouteDenied = location.pathname.startsWith("/app/platform")
    && (!isPlatformAdmin(user) || hasAgencyContext(user));

  return (
    <SidebarProvider defaultOpen={false} data-active-module={activeModule}>
      <AppSidebar variant="floating" />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <AppHeader />
        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden px-4 py-4">
          {agencyContextMissing ? (
            <Navigate to="/app/platform" replace />
          ) : platformRouteDenied ? (
            <Navigate to="/app" replace />
          ) : canAccessRoute ? (
            <Outlet />
          ) : (
            <AccessDenied />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
