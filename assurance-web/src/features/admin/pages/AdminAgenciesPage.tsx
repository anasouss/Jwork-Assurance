import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { AgenciesPanel } from "../components/AdminPanels";
import { adminApi } from "../api";
import { useAdminAccess } from "./admin-access";

export default function AdminAgenciesPage() {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const access = useAdminAccess();
  const agencies = useQuery({
    queryKey: ["admin", "agencies"],
    queryFn: adminApi.agencies,
    staleTime: 60_000,
    enabled: access.canAccessAgencySettings,
  });
  const expectedPath = `/app/admin/${access.agencySection}`;

  if (!access.canAccessAgencySettings) return <Navigate to={access.defaultPath} replace />;
  if (pathname !== expectedPath) return <Navigate to={expectedPath} replace />;

  return (
    <AgenciesPanel
      agencies={agencies.data ?? []}
      loading={agencies.isLoading}
      canManage={access.canManagePlatformAgencies || access.canManageOwnAgency}
      canCreate={access.isPlatformMode && access.canManagePlatformAgencies}
      canEditPlatformFields={access.isPlatformMode && access.canManagePlatformAgencies}
      onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "agencies"] })}
    />
  );
}
