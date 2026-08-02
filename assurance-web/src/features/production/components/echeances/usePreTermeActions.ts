import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { contractKeys } from "@/lib/query-keys";
import { contractApi } from "../../api/contracts";
import { renewalDraftPath } from "../../renewals/navigation";
import type { EcheanceAutomobileRow } from "../../types";

export function usePreTermeActions() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const prepareMutation = useMutation({
    mutationFn: (contratId: string) => contractApi.createRenouvellementDraft(contratId, "CABINET"),
    onSuccess: (draft) => navigate(renewalDraftPath(draft, `${location.pathname}${location.search}`)),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création du pré-terme impossible"),
  });

  const finalizeMutation = useMutation({
    mutationFn: ({ draftId, mode }: { draftId: string; mode: "CABINET" | "COMPAGNIE" }) =>
      contractApi.finalizeRenouvellementDraft(draftId, mode),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contractKeys.all });
      toast.success("Contrat renouvelé");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Renouvellement impossible"),
  });

  function edit(row: EcheanceAutomobileRow) {
    if (row.preTermeDraftId) {
      navigate(renewalDraftPath(
        { id: row.preTermeDraftId, typeContrat: row.typeContrat },
        `${location.pathname}${location.search}`
      ));
      return;
    }
    prepareMutation.mutate(row.contratId);
  }

  return { edit, prepareMutation, finalizeMutation };
}
