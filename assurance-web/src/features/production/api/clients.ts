import { apiFetch, apiFetchBlob, apiUpload, buildQueryString } from "@/lib/api/base";
import type {
  ApiResponse,
  AcquisitionClient,
  AcquisitionOptions,
  ClientCrm,
  ClientInput,
  ClientPage,
  ClientPaymentCondition,
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

  async listPaymentConditions(payeurType: "CLIENT" | "GROUPE", payeurId: string) {
    return unwrap(
      await apiFetch<ApiResponse<ClientPaymentCondition[]>>(
        `/api/v1/conditions-paiement-clients${buildQueryString({ payeurType, payeurId })}`
      )
    ).map(normalizePaymentCondition);
  },

  async createPaymentCondition(request: {
    payeurType: "CLIENT" | "GROUPE";
    payeurId: string;
    delaiJours: number;
    typeJustification: ClientPaymentCondition["typeJustification"];
    dateDebut: string;
    dateFin?: string;
    commentaire?: string;
    justificatif?: File;
  }) {
    const data = new FormData();
    data.set("payeurType", request.payeurType);
    data.set("payeurId", request.payeurId);
    data.set("delaiJours", String(request.delaiJours));
    data.set("typeJustification", request.typeJustification);
    data.set("dateDebut", request.dateDebut);
    if (request.dateFin) data.set("dateFin", request.dateFin);
    if (request.commentaire) data.set("commentaire", request.commentaire);
    if (request.justificatif) data.set("justificatif", request.justificatif);
    return normalizePaymentCondition(unwrap(
      await apiUpload<ApiResponse<ClientPaymentCondition>>("/api/v1/conditions-paiement-clients", data)
    ));
  },

  async downloadPaymentConditionEvidence(id: string) {
    return apiFetchBlob(`/api/v1/conditions-paiement-clients/${id}/justificatif`);
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

function normalizePaymentCondition(condition: ClientPaymentCondition): ClientPaymentCondition {
  return {
    ...condition,
    id: String(condition.id),
    payeurId: String(condition.payeurId),
  };
}
