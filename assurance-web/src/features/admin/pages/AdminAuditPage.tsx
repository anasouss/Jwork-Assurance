import { Navigate } from "react-router-dom";
import { AuditPanel } from "../components/AdminPanels";
import { useAdminAccess } from "./admin-access";

export default function AdminAuditPage() {
  const access = useAdminAccess();
  if (!access.canViewAudit) return <Navigate to={access.defaultPath} replace />;
  return <AuditPanel />;
}
