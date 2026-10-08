import AgencyDashboardPage from "@/features/dashboard/pages/AgencyDashboardPage";
import { Navigate } from "react-router-dom";
import { firstAccessibleAgencyPath } from "@/components/app-navigation";
import { isPlatformMode } from "@/lib/platform-context";
import { useAuthStore } from "@/store/auth-store";

export default function AppIndexPage() {
  const user = useAuthStore((state) => state.user);
  if (isPlatformMode(user)) {
    return <Navigate to="/app/platform" replace />;
  }
  const permissions = user?.permissions ?? [];
  if (!permissions.includes("contrat:view") && !permissions.includes("quittance:view")) {
    return <Navigate to={firstAccessibleAgencyPath(permissions, {
      platformAdmin: Boolean(user?.platformAdmin),
      hasAgencyContext: Boolean(user?.agenceId),
    })} replace />;
  }
  return <AgencyDashboardPage />;
}
