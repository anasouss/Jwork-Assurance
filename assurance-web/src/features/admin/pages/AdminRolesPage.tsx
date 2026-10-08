import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";
import { RolesPanel } from "../components/AdminPanels";
import { adminApi } from "../api";
import type { AdminAgency } from "../types";
import { useAdminAccess } from "./admin-access";

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const { roleId } = useParams<{ roleId?: string }>();
  const access = useAdminAccess();
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: adminApi.roles, staleTime: 30_000 });
  const permissions = useQuery({ queryKey: ["admin", "permissions"], queryFn: adminApi.permissions, staleTime: 60_000 });
  const agencies = useQuery({
    queryKey: ["admin", "agencies"],
    queryFn: adminApi.agencies,
    staleTime: 60_000,
    enabled: access.canAccessAgencySettings,
  });
  const availableAgencies = useMemo<AdminAgency[]>(() => {
    if (access.canAccessAgencySettings) return agencies.data ?? [];
    return access.user?.agenceId ? [{
      id: access.user.agenceId,
      code: "",
      nom: access.user.agenceName ?? "Agence",
      logoDisponible: false,
      signatureDisponible: false,
      statut: "ACTIVE",
    }] : [];
  }, [access.canAccessAgencySettings, access.user?.agenceId, access.user?.agenceName, agencies.data]);

  if (!access.canViewRoles) return <Navigate to={access.defaultPath} replace />;

  return (
    <RolesPanel
      roles={roles.data ?? []}
      loading={roles.isLoading}
      permissions={permissions.data ?? []}
      agencies={availableAgencies}
      canManage={access.canManageRoles}
      roleId={roleId}
      onChanged={async () => {
        await queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
        await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      }}
    />
  );
}
