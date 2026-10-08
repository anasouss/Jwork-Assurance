import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { UsersPanel } from "../components/AdminPanels";
import { adminApi } from "../api";
import type { AdminAgency } from "../types";
import { useAdminAccess } from "./admin-access";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const access = useAdminAccess();
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: adminApi.users, staleTime: 30_000 });
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: adminApi.roles, staleTime: 30_000 });
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

  if (!access.canViewUsers) return <Navigate to={access.defaultPath} replace />;

  return (
    <UsersPanel
      users={users.data ?? []}
      loading={users.isLoading}
      roles={roles.data ?? []}
      agencies={availableAgencies}
      canSelectAgency={access.isPlatformMode}
      currentAgencyId={access.user?.agenceId ?? undefined}
      currentAgencyName={access.user?.agenceName ?? undefined}
      canManage={access.canManageUsers}
      currentUserId={access.user?.id}
      onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })}
    />
  );
}
