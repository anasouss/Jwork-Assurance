import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildQueryString } from "@/lib/api/base";
import { useAuthStore } from "@/store/auth-store";
import type { ApiResponse, PagedResponse } from "@/features/production/types";
import { unwrapApiResponse } from "@/features/production/api/response";

export type PortalAccount = {
  id: string; clientId: string; clientNom: string; identifiant: string;
  actif: boolean; passwordChangeRequired: boolean; lastLoginAt: string | null;
};
export type PortalAccess = {
  id: string; contratId: string | null; sinistreId: string | null; actif: boolean;
  reference: string | null; numeroPolice: string | null; dateDebut: string | null; dateFin: string | null; statut: string;
};
export type PortalCandidate = { id: string; reference: string | null; numeroPolice: string | null; date: string | null; statut: string };
export type PortalPublication = {
  id: string; titre: string; message: string | null; published: boolean;
  pieceJointeId: string | null; sinistreDocumentId: string | null; createdAt: string;
};
export type PortalSource = { id: string; nomFichier: string; createdAt: string };
export type PortalKind = "contract" | "claim";

const base = "/api/v1/client-accounts";
const id = encodeURIComponent;
async function get<T>(path: string) {
  return unwrapApiResponse(await apiFetch<ApiResponse<T>>(`${base}${path}`));
}
async function send<T = void>(path: string, method: string, body?: unknown) {
  return unwrapApiResponse(await apiFetch<ApiResponse<T>>(`${base}${path}`, {
    method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
export const portalKeys = {
  root: (agency: string) => ["crm", "client-portal", agency] as const,
  availability: (agency: string) => [...portalKeys.root(agency), "availability"] as const,
  account: (agency: string, client: string) => [...portalKeys.root(agency), "account", client] as const,
  accesses: (agency: string, account: string, page: number) => [...portalKeys.root(agency), "access", account, page] as const,
  candidates: (agency: string, account: string, kind: PortalKind, query: string, page: number) =>
    [...portalKeys.root(agency), "candidates", account, kind, query, page] as const,
  publications: (agency: string, access: string, kind: "documents" | "updates", page: number) =>
    [...portalKeys.root(agency), "publications", access, kind, page] as const,
  sources: (agency: string, access: string, page: number) => [...portalKeys.root(agency), "sources", access, page] as const,
};
export const portalApi = {
  availability: () => get<{ enabled: boolean }>("/availability"),
  account: async (client: string): Promise<PortalAccount | null> =>
    (await get<PortalAccount | null>(`/for-client/${id(client)}`)) ?? null,
  create: (clientId: string, identifiant: string, password: string) =>
    send<PortalAccount>("", "POST", { clientId, identifiant, password }),
  active: (account: string, actif: boolean) => send(`/${id(account)}/active`, "PUT", { actif }),
  password: (account: string, password: string) => send(`/${id(account)}/password`, "POST", { password }),
  accesses: (account: string, page: number) => get<PagedResponse<PortalAccess>>(`/${id(account)}/access${buildQueryString({ page, size: 10 })}`),
  candidates: (account: string, kind: PortalKind, query: string, page: number) =>
    get<PagedResponse<PortalCandidate>>(`/${id(account)}/candidates${buildQueryString({ claim: kind === "claim", query, page, size: 10 })}`),
  grant: (account: string, kind: PortalKind, target: string) =>
    send<PortalAccess>(`/${id(account)}/access`, "POST", kind === "claim" ? { sinistreId: target } : { contratId: target }),
  revoke: (access: string) => send(`/access/${id(access)}`, "DELETE"),
  publications: (access: string, kind: "documents" | "updates", page: number) =>
    get<PagedResponse<PortalPublication>>(`/access/${id(access)}/${kind}${buildQueryString({ page, size: 10 })}`),
  sources: (access: string, page: number) =>
    get<PagedResponse<PortalSource>>(`/access/${id(access)}/sources${buildQueryString({ page, size: 10 })}`),
  publishDocument: (access: PortalAccess, source: string, titre: string) =>
    send(`/access/${id(access.id)}/documents`, "POST",
      { titre, ...(access.sinistreId ? { sinistreDocumentId: source } : { pieceJointeId: source }) }),
  publishUpdate: (access: string, titre: string, message: string) =>
    send(`/access/${id(access)}/updates`, "POST", { titre, message }),
  withdraw: (publication: string, kind: "documents" | "updates") => send(`/${kind}/${id(publication)}`, "DELETE"),
};
export function useClientPortalAvailability() {
  const user = useAuthStore(state => state.user);
  const agency = user?.agenceId ?? "";
  return useQuery({
    queryKey: portalKeys.availability(agency),
    queryFn: portalApi.availability,
    enabled: Boolean(agency && user?.permissions.includes("client-portal-account:view")),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
}
