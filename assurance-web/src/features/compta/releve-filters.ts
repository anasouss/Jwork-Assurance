import type { ClientDocumentStatus, ClientDocumentType, TypeContrat } from "./types";

export type ReleveTab = "sources" | "documents";

export type SourceFilters = {
  typeContrat: "ALL" | TypeContrat;
  dateDu: string;
  dateAu: string;
  search: string;
};

export type DocumentFilters = {
  type: "ALL" | ClientDocumentType;
  statut: "ALL" | ClientDocumentStatus;
  dateDu: string;
  dateAu: string;
  search: string;
};

export type ReleveSearchState = {
  payerType: "CLIENT" | "GROUPE";
  payerId: string;
  tab: ReleveTab;
  sourceFilters: SourceFilters;
  sourcePage: number;
  documentFilters: DocumentFilters;
  documentPage: number;
};

export const SOURCE_DEFAULTS: SourceFilters = {
  typeContrat: "ALL",
  dateDu: "",
  dateAu: "",
  search: "",
};

export const DOCUMENT_DEFAULTS: DocumentFilters = {
  type: "ALL",
  statut: "ALL",
  dateDu: "",
  dateAu: "",
  search: "",
};

export function releveSearchStateFromParams(params: URLSearchParams): ReleveSearchState {
  const sourceType = params.get("sourceTypeContrat");
  const documentType = params.get("documentType");
  const documentStatus = params.get("documentStatut");
  return {
    payerType: params.get("payeurType") === "GROUPE" ? "GROUPE" : "CLIENT",
    payerId: params.get("payeurId") ?? "",
    tab: params.get("tab") === "documents" ? "documents" : "sources",
    sourceFilters: {
      typeContrat: isContractType(sourceType) ? sourceType : "ALL",
      dateDu: validDate(params.get("sourceDateDu")),
      dateAu: validDate(params.get("sourceDateAu")),
      search: params.get("sourceSearch") ?? "",
    },
    sourcePage: pageFromParam(params.get("sourcePage")),
    documentFilters: {
      type: documentType === "RELEVE" || documentType === "FACTURE" ? documentType : "ALL",
      statut: documentStatus === "EMIS" || documentStatus === "ANNULE" ? documentStatus : "ALL",
      dateDu: validDate(params.get("documentDateDu")),
      dateAu: validDate(params.get("documentDateAu")),
      search: params.get("documentSearch") ?? "",
    },
    documentPage: pageFromParam(params.get("documentPage")),
  };
}

export function releveSearchParams(state: ReleveSearchState) {
  const params = new URLSearchParams();
  if (state.payerType === "GROUPE") params.set("payeurType", "GROUPE");
  if (state.payerId) params.set("payeurId", state.payerId);
  if (state.tab === "documents") params.set("tab", "documents");

  if (state.sourceFilters.typeContrat !== "ALL") {
    params.set("sourceTypeContrat", state.sourceFilters.typeContrat);
  }
  if (state.sourceFilters.dateDu) params.set("sourceDateDu", state.sourceFilters.dateDu);
  if (state.sourceFilters.dateAu) params.set("sourceDateAu", state.sourceFilters.dateAu);
  if (state.sourceFilters.search.trim()) params.set("sourceSearch", state.sourceFilters.search.trim());
  if (state.sourcePage > 0) params.set("sourcePage", String(state.sourcePage + 1));

  if (state.documentFilters.type !== "ALL") params.set("documentType", state.documentFilters.type);
  if (state.documentFilters.statut !== "ALL") params.set("documentStatut", state.documentFilters.statut);
  if (state.documentFilters.dateDu) params.set("documentDateDu", state.documentFilters.dateDu);
  if (state.documentFilters.dateAu) params.set("documentDateAu", state.documentFilters.dateAu);
  if (state.documentFilters.search.trim()) params.set("documentSearch", state.documentFilters.search.trim());
  if (state.documentPage > 0) params.set("documentPage", String(state.documentPage + 1));
  return params;
}

function isContractType(value: string | null): value is TypeContrat {
  return value === "PARTICULIER" || value === "CONVENTION" || value === "FLOTTE";
}

function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function pageFromParam(value: string | null) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(page) && page > 0 ? page - 1 : 0;
}
