import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { LoadingPage } from "@/components/shared";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuthStore } from "@/store/auth-store";

export default function AppLayout() {
  const navigate = useNavigate();
  const { hydrate, isAuthenticated, isHydrated, user } = useAuthStore();

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

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar variant="floating" />
      <SidebarInset>
        <AppHeader />
        <main className="flex flex-1 flex-col gap-4 px-4 py-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
