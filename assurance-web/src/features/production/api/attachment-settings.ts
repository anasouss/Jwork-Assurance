import { apiFetch, buildQueryString } from "@/lib/api/base";
import type {
  ApiResponse,
  ReferenceOption,
  TypePieceJointe,
  UpsertTypePieceJointeRequest,
} from "../types";

import { unwrapApiResponse as unwrap } from "./response";

export const attachmentSettingsApi = {
  async listTypes(includeInactive = false) {
    return unwrap(
      await apiFetch<ApiResponse<TypePieceJointe[]>>(
        `/api/v1/pieces-jointes/types${buildQueryString({
          includeInactive: String(includeInactive),
        })}`,
      ),
    );
  },

  async listMovementTypes() {
    return unwrap(
      await apiFetch<ApiResponse<ReferenceOption[]>>(
        "/api/v1/pieces-jointes/types-mouvements",
      ),
    );
  },

  async createType(request: UpsertTypePieceJointeRequest) {
    return unwrap(
      await apiFetch<ApiResponse<TypePieceJointe>>("/api/v1/pieces-jointes/types", {
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
  },

  async updateType(id: string, request: UpsertTypePieceJointeRequest) {
    return unwrap(
      await apiFetch<ApiResponse<TypePieceJointe>>(`/api/v1/pieces-jointes/types/${id}`, {
        method: "PUT",
        body: JSON.stringify(request),
      }),
    );
  },

  async deleteType(id: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(`/api/v1/pieces-jointes/types/${id}`, {
        method: "DELETE",
      }),
    );
  },
};
