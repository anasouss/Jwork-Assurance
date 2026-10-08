import { Navigate } from "react-router-dom";
import { useAdminAccess } from "./admin-access";

export default function AdminIndexPage() {
  const { defaultPath } = useAdminAccess();
  return <Navigate to={defaultPath} replace />;
}
