import { apiFetch, apiFetchBlob, apiUpload, buildQueryString } from "@/lib/api/base";
import type { ApiResponse, PieceJointe, PiecesJointesContrat } from "../types";

import { unwrapApiResponse as unwrap } from "./response";

export const attachmentApi = {
  async getContratPiecesJointes(contratId: string, mouvementId?: string | null) {
    return unwrap(
      await apiFetch<ApiResponse<PiecesJointesContrat>>(
        `/api/v1/contrats/${contratId}/pieces-jointes${buildQueryString({
          mouvementId: mouvementId ?? undefined,
        })}`
      )
    );
  },

  async uploadPieceJointe(
    contratId: string,
    payload: {
      typePieceJointeId?: string;
      customTypeLabel?: string;
      mouvementId?: string | null;
      files: File[];
    }
  ) {
    const formData = new FormData();
    if (payload.typePieceJointeId) {
      formData.append("typePieceJointeId", payload.typePieceJointeId);
    }
    if (payload.customTypeLabel?.trim()) {
      formData.append("customTypeLabel", payload.customTypeLabel.trim());
    }
    if (payload.mouvementId) {
      formData.append("mouvementId", payload.mouvementId);
    }
    payload.files.forEach((file) => formData.append("files", file));

    return unwrap(
      await apiUpload<ApiResponse<PieceJointe>>(
        `/api/v1/contrats/${contratId}/pieces-jointes`,
        formData
      )
    );
  },

  async downloadPieceJointe(contratId: string, pieceId: string) {
    return apiFetchBlob(
      `/api/v1/contrats/${contratId}/pieces-jointes/${pieceId}/download`
    );
  },

  async deletePieceJointe(contratId: string, pieceId: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(
        `/api/v1/contrats/${contratId}/pieces-jointes/${pieceId}`,
        { method: "DELETE" }
      )
    );
  },
};
