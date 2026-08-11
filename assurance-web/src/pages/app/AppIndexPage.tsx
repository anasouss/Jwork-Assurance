import AgencyDashboardPage from "@/features/dashboard/pages/AgencyDashboardPage";
import { Navigate } from "react-router-dom";
import { isPlatformMode } from "@/lib/platform-context";
import { useAuthStore } from "@/store/auth-store";

export default function AppIndexPage() {
  const user = useAuthStore((state) => state.user);
  return isPlatformMode(user) ? <Navigate to="/app/platform" replace /> : <AgencyDashboardPage />;
}
