import { apiFetch, buildQueryString } from "@/lib/api/base";
import type {
  ApiResponse,
  AcquisitionClient,
  AcquisitionOptions,
  ClientCrm,
  ClientInput,
  ClientPage,
  ClientResponse,
  GroupeClient,
  OrigineCommerciale,
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
    params: {
      query?: string;
      groupeId?: string;
      origineCommercialeId?: string;
      collaborateurId?: string;
      page?: number;
      size?: number;
    } = {}
  ) {
    return unwrap(
      await apiFetch<ApiResponse<ClientPage>>(`/api/v1/clients${buildQueryString(params)}`)
    );
  },

  async getClientCrm(clientId: string) {
    return unwrap(await apiFetch<ApiResponse<ClientCrm>>(`/api/v1/clients/${clientId}`));
  },

  async acquisitionOptions() {
    return unwrap(
      await apiFetch<ApiResponse<AcquisitionOptions>>("/api/v1/clients/acquisition/options")
    );
  },

  async updateAcquisition(clientId: string, request: AcquisitionClient) {
    return unwrap(
      await apiFetch<ApiResponse<AcquisitionClient>>(`/api/v1/clients/${clientId}/acquisition`, {
        method: "PUT",
        body: JSON.stringify(request),
      })
    );
  },

  async createOrigin(request: Omit<OrigineCommerciale, "id">) {
    return unwrap(
      await apiFetch<ApiResponse<OrigineCommerciale>>("/api/v1/clients/origines-commerciales", {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  },

  async updateOrigin(id: string, request: Omit<OrigineCommerciale, "id">) {
    return unwrap(
      await apiFetch<ApiResponse<OrigineCommerciale>>(`/api/v1/clients/origines-commerciales/${id}`, {
        method: "PUT",
        body: JSON.stringify(request),
      })
    );
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
