import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { PlatformAdminsPanel } from "../components/AdminPanels";
import { adminApi } from "../api";
import { useAdminAccess } from "./admin-access";

export default function PlatformAdminsPage() {
  const queryClient = useQueryClient();
  const access = useAdminAccess();
  const users = useQuery({
    queryKey: ["admin", "platform-admins"],
    queryFn: adminApi.platformAdmins,
    staleTime: 30_000,
    enabled: access.isPlatformMode,
  });

  if (!access.isPlatformMode) return <Navigate to={access.defaultPath} replace />;

  return (
    <PlatformAdminsPanel
      users={users.data ?? []}
      loading={users.isLoading}
      currentUserId={access.user?.id}
      onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "platform-admins"] })}
    />
  );
}
