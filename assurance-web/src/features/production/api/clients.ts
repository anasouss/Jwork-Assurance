import { apiFetch, buildQueryString } from "@/lib/api/base";
import type {
  ApiResponse,
  ClientCrm,
  ClientInput,
  ClientPage,
  ClientResponse,
  GroupeClient,
  RelationGroupeClient,
  VehiculeResponse,
} from "../types";

import { unwrapApiResponse as unwrap } from "./response";

type GroupeClientRequest = {
  code: string;
  libelle: string;
  clientTeteId?: string;
  clientTresorerieId?: string;
  facturationConsolideeDefaut?: boolean;
  actif?: boolean;
};

export const clientApi = {
  async searchClient(params: { cin?: string; rc?: string }) {
    return unwrap(
      await apiFetch<ApiResponse<ClientResponse | null>>(
        `/api/v1/clients/search${buildQueryString(params)}`
      )
    );
  },

  async listClients(
    params: { query?: string; groupeId?: string; page?: number; size?: number } = {}
  ) {
    return unwrap(
      await apiFetch<ApiResponse<ClientPage>>(`/api/v1/clients${buildQueryString(params)}`)
    );
  },

  async getClientCrm(clientId: string) {
    return unwrap(await apiFetch<ApiResponse<ClientCrm>>(`/api/v1/clients/${clientId}`));
  },

  async createClient(
    request: ClientInput["client"] & {
      groupeClientId?: string;
      relationGroupe?: RelationGroupeClient;
    }
  ) {
    return unwrap(
      await apiFetch<ApiResponse<ClientResponse>>("/api/v1/clients", {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async listGroupesClients() {
    return unwrap(await apiFetch<ApiResponse<GroupeClient[]>>("/api/v1/groupes-clients"));
  },

  async createGroupeClient(request: GroupeClientRequest) {
    return unwrap(
      await apiFetch<ApiResponse<GroupeClient>>("/api/v1/groupes-clients", {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async updateGroupeClient(id: string, request: GroupeClientRequest) {
    return unwrap(
      await apiFetch<ApiResponse<GroupeClient>>(`/api/v1/groupes-clients/${id}`, {
        method: "PUT",
        body: JSON.stringify(request),
      })
    );
  },

  async assignClientGroup(
    clientId: string,
    request: {
      groupeClientId: string;
      typeRelation: RelationGroupeClient;
      principal?: boolean;
    }
  ) {
    return unwrap(
      await apiFetch<ApiResponse<ClientResponse["groupe"]>>(
        `/api/v1/clients/${clientId}/groupe`,
        { method: "PUT", body: JSON.stringify(request) }
      )
    );
  },

  async endClientGroup(clientId: string, membershipId: string) {
    return unwrap(
      await apiFetch<ApiResponse<void>>(
        `/api/v1/clients/${clientId}/groupes/${membershipId}`,
        { method: "DELETE" }
      )
    );
  },

  async searchVehicule(params: { immatriculation?: string }) {
    return unwrap(
      await apiFetch<ApiResponse<VehiculeResponse | null>>(
        `/api/v1/vehicules/search${buildQueryString(params)}`
      )
    );
  },
};
