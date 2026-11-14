import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { PermissionButton } from "@/components/shared/permission-button";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/lib/toast";
import { contractCreationApi } from "../api/contract-creation";

export function VehicleExcelExportButton({ contratId }: { contratId?: string }) {
  const [exporting, setExporting] = useState(false);
  const canView = useAuthStore(state => state.user?.permissions.includes("contrat:view") ?? false);

  const exportVehicles = async () => {
    if (!contratId || exporting || !canView) return;
    setExporting(true);
    try {
      const blob = await contractCreationApi.exportSubmittedVehicles(contratId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "vehicules-flotte.xlsx";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export Excel impossible");
    } finally {
      setExporting(false);
    }
  };

  if (!canView) return null;

  return (
    <PermissionButton
      permission="contrat:export"
      type="button"
      variant="outline"
      size="sm"
      title="Exporter les véhicules enregistrés"
      disabled={!contratId || exporting}
      onClick={() => void exportVehicles()}
    >
      {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
      Exporter Excel
    </PermissionButton>
  );
}
