import { apiFetch, apiFetchBlob, apiUpload, buildQueryString } from "@/lib/api/base";
import type { ApiResponse, DocumentExpiry, DocumentOwner, DocumentValiditySource, PieceJointe, PiecesJointesContrat, TypeClient, TypePieceJointe } from "../types";

import { unwrapApiResponse as unwrap } from "./response";

export const attachmentKeys = {
  clients: ["client-documents"] as const,
  client: (clientId: string) => ["client-documents", clientId] as const,
  clientTypes: (typeClient: TypeClient) => ["client-document-types", typeClient] as const,
};

export const attachmentApi = {
  async clientTypes(typeClient: TypeClient) {
    return unwrap(await apiFetch<ApiResponse<TypePieceJointe[]>>(`/api/v1/clients/documents/types${buildQueryString({ typeClient })}`));
  },
  async clientDocuments(clientId: string) {
    return unwrap(await apiFetch<ApiResponse<PieceJointe[]>>(`/api/v1/clients/${clientId}/pieces-jointes`));
  },
  async uploadClient(clientId: string, payload: { typePieceJointeId: string; files: File[]; expiresOn?: string; previousVersionId?: string; reason?: string }) {
    const form = new FormData();
    form.append("typePieceJointeId", payload.typePieceJointeId);
    if (payload.expiresOn) form.append("expiresOn", payload.expiresOn);
    if (payload.previousVersionId) form.append("previousVersionId", payload.previousVersionId);
    if (payload.reason) form.append("reason", payload.reason);
    payload.files.forEach(file => form.append("files", file));
    return unwrap(await apiUpload<ApiResponse<PieceJointe>>(`/api/v1/clients/${clientId}/pieces-jointes`, form));
  },
  async deleteClient(clientId: string, pieceId: string) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/clients/${clientId}/pieces-jointes/${pieceId}`, { method: "DELETE" }));
  },
  downloadClient(clientId: string, pieceId: string) {
    return apiFetchBlob(`/api/v1/clients/${clientId}/pieces-jointes/${pieceId}/download`);
  },
  async savePolicy(natureId: string, owner: DocumentOwner, expiry: DocumentExpiry, source: DocumentValiditySource) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/pieces-jointes/natures/${natureId}/policy${buildQueryString({ owner, expiry, source })}`, { method: "PUT" }));
  },
  async assignOwner(contratId: string, pieceId: string, clientId?: string, vehiculeId?: string) {
    return unwrap(await apiFetch<ApiResponse<PieceJointe>>(`/api/v1/contrats/${contratId}/pieces-jointes/${pieceId}/owner${buildQueryString({ clientId, vehiculeId })}`, { method: "POST" }));
  },
  async unlink(contratId: string, pieceId: string, mouvementId?: string | null) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/contrats/${contratId}/pieces-jointes/${pieceId}/usage${buildQueryString({ mouvementId: mouvementId ?? undefined })}`, { method: "DELETE" }));
  },
  async reuse(contratId: string, pieceId: string, typePieceJointeId: string, mouvementId?: string | null) {
    return unwrap(await apiFetch<ApiResponse<PieceJointe>>(`/api/v1/contrats/${contratId}/pieces-jointes/reuse${buildQueryString({ pieceId, typePieceJointeId, mouvementId: mouvementId ?? undefined })}`, { method: "POST" }));
  },
  async replace(contratId: string, pieceId: string, files: File[], expiresOn: string, reason: string) {
    const form = new FormData();
    files.forEach(file => form.append("files", file));
    if (expiresOn) form.append("expiresOn", expiresOn);
    form.append("reason", reason);
    return unwrap(await apiUpload<ApiResponse<PieceJointe>>(`/api/v1/contrats/${contratId}/pieces-jointes/${pieceId}/replace`, form));
  },
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
      clientId?: string;
      vehiculeId?: string;
      expiresOn?: string;
    }
  ) {
    const formData = new FormData();
    if (payload.clientId) formData.append("clientId", payload.clientId);
    if (payload.vehiculeId) formData.append("vehiculeId", payload.vehiculeId);
    if (payload.expiresOn) formData.append("expiresOn", payload.expiresOn);
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
