import type { ClientDocumentStatus, ClientDocumentType, TypeContrat } from "./types";

export type ReleveTab = "sources" | "documents";

export type SourceFilters = {
  brancheId: string;
  compagnieId: string;
  typeContrat: "ALL" | TypeContrat;
  documentState: "ALL" | "SANS_DOCUMENT" | "RELEVE" | "FACTURE";
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
  payerScope: "CLIENT" | "GROUPE";
  payerType: "CLIENT" | "GROUPE";
  payerId: string;
  tab: ReleveTab;
  sourceFilters: SourceFilters;
  sourcePage: number;
  sourceSortBy: "dateDebut" | "primeTotale";
  sourceSortDirection: "asc" | "desc";
  documentFilters: DocumentFilters;
  documentPage: number;
  documentSortBy: "dateEmission" | "numero" | "totalDocument" | "statut";
  documentSortDirection: "asc" | "desc";
};

export const SOURCE_DEFAULTS: SourceFilters = {
  brancheId: "ALL",
  compagnieId: "ALL",
  typeContrat: "ALL",
  documentState: "ALL",
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
  const documentStatus = params.get("documentStatut");
  const payerId = params.get("payeurId") ?? "";
  const payerType = params.get("payeurType") === "GROUPE" ? "GROUPE" : "CLIENT";
  const requestedScope = params.get("cible");
  const payerScope = requestedScope === "GROUPE" ? "GROUPE" : payerType;
  return {
    payerScope,
    payerType,
    payerId,
    tab: params.get("tab") === "documents" ? "documents" : "sources",
    sourceFilters: {
      brancheId: params.get("sourceBrancheId") ?? "ALL",
      compagnieId: params.get("sourceCompagnieId") ?? "ALL",
      typeContrat: isContractType(sourceType) ? sourceType : "ALL",
      documentState: isDocumentState(params.get("sourceDocumentState"))
        ? params.get("sourceDocumentState") as SourceFilters["documentState"]
        : "ALL",
      dateDu: validDate(params.get("sourceDateDu")),
      dateAu: validDate(params.get("sourceDateAu")),
      search: params.get("sourceSearch") ?? "",
    },
    sourcePage: pageFromParam(params.get("sourcePage")),
    sourceSortBy: params.get("sourceSortBy") === "primeTotale" ? "primeTotale" : "dateDebut",
    sourceSortDirection: params.get("sourceSortDirection") === "asc" ? "asc" : "desc",
    documentFilters: {
      type: params.get("documentType") === "RELEVE" || params.get("documentType") === "FACTURE"
        ? params.get("documentType") as ClientDocumentType
        : "ALL",
      statut: documentStatus === "EMIS" || documentStatus === "ANNULE" ? documentStatus : "ALL",
      dateDu: validDate(params.get("documentDateDu")),
      dateAu: validDate(params.get("documentDateAu")),
      search: params.get("documentSearch") ?? "",
    },
    documentPage: pageFromParam(params.get("documentPage")),
    documentSortBy: isDocumentSortBy(params.get("documentSortBy"))
      ? params.get("documentSortBy") as ReleveSearchState["documentSortBy"] : "dateEmission",
    documentSortDirection: params.get("documentSortDirection") === "asc" ? "asc" : "desc",
  };
}

export function releveSearchParams(state: ReleveSearchState) {
  const params = new URLSearchParams();
  params.set("cible", state.payerScope);
  if (state.payerType === "GROUPE") params.set("payeurType", "GROUPE");
  if (state.payerId) params.set("payeurId", state.payerId);
  if (state.tab === "documents") params.set("tab", "documents");

  if (state.sourceFilters.typeContrat !== "ALL") {
    params.set("sourceTypeContrat", state.sourceFilters.typeContrat);
  }
  if (state.sourceFilters.brancheId !== "ALL") {
    params.set("sourceBrancheId", state.sourceFilters.brancheId);
  }
  if (state.sourceFilters.compagnieId !== "ALL") {
    params.set("sourceCompagnieId", state.sourceFilters.compagnieId);
  }
  if (state.sourceFilters.documentState !== "ALL") {
    params.set("sourceDocumentState", state.sourceFilters.documentState);
  }
  if (state.sourceFilters.dateDu) params.set("sourceDateDu", state.sourceFilters.dateDu);
  if (state.sourceFilters.dateAu) params.set("sourceDateAu", state.sourceFilters.dateAu);
  if (state.sourceFilters.search.trim()) params.set("sourceSearch", state.sourceFilters.search.trim());
  if (state.sourcePage > 0) params.set("sourcePage", String(state.sourcePage + 1));
  if (state.sourceSortBy !== "dateDebut") params.set("sourceSortBy", state.sourceSortBy);
  if (state.sourceSortDirection !== "desc") params.set("sourceSortDirection", state.sourceSortDirection);

  if (state.documentFilters.type !== "ALL") params.set("documentType", state.documentFilters.type);
  if (state.documentFilters.statut !== "ALL") params.set("documentStatut", state.documentFilters.statut);
  if (state.documentFilters.dateDu) params.set("documentDateDu", state.documentFilters.dateDu);
  if (state.documentFilters.dateAu) params.set("documentDateAu", state.documentFilters.dateAu);
  if (state.documentFilters.search.trim()) params.set("documentSearch", state.documentFilters.search.trim());
  if (state.documentPage > 0) params.set("documentPage", String(state.documentPage + 1));
  if (state.documentSortBy !== "dateEmission") params.set("documentSortBy", state.documentSortBy);
  if (state.documentSortDirection !== "desc") params.set("documentSortDirection", state.documentSortDirection);
  return params;
}

function isDocumentSortBy(value: string | null): value is ReleveSearchState["documentSortBy"] {
  return value === "dateEmission" || value === "numero" || value === "totalDocument" || value === "statut";
}

function isContractType(value: string | null): value is TypeContrat {
  return value === "PARTICULIER" || value === "CONVENTION" || value === "FLOTTE";
}

function isDocumentState(value: string | null): value is SourceFilters["documentState"] {
  return value === "SANS_DOCUMENT" || value === "RELEVE" || value === "FACTURE";
}

function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function pageFromParam(value: string | null) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(page) && page > 0 ? page - 1 : 0;
}
