import type { AgencyContextOption, ApiResponse, AuthResponse, AuthSession } from "@/lib/types";
import { API_BASE_URL, apiFetch, normalizeApiIds, refreshAuthSession } from "./base";
import { clearAuth, saveAuth } from "@/lib/auth";

export type LoginRequest = {
  email: string;
  password: string;
};

export const authApi = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Request": "1",
        },
        body: JSON.stringify(data),
      });
    } catch {
      throw new Error("Service inaccessible");
    }

    if (!response.ok) {
      throw new Error(await loginErrorMessage(response));
    }

    const result = normalizeApiIds(await response.json()) as ApiResponse<AuthResponse>;
    if (!result.success) {
      throw new Error(result.message || "Échec de la connexion");
    }

    saveAuth(result.data);
    return result.data;
  },

  async refresh(): Promise<AuthResponse> {
    return await refreshAuthSession();
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: "DELETE",
        credentials: "include",
        headers: { "X-Auth-Request": "1" },
      });
    } finally {
      clearAuth();
    }
  },

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    const result = await apiFetch<ApiResponse<void>>("/api/v1/auth/password", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!result.success) {
      throw new Error(result.message || "Mot de passe impossible à modifier");
    }
  },

  async sessions(): Promise<AuthSession[]> {
    const result = await apiFetch<ApiResponse<AuthSession[]>>("/api/v1/auth/sessions");
    if (!result.success) {
      throw new Error(result.message || "Sessions impossibles à charger");
    }
    return result.data ?? [];
  },

  async revokeSession(sessionId: string): Promise<void> {
    const result = await apiFetch<ApiResponse<void>>(`/api/v1/auth/sessions/${sessionId}`, {
      method: "DELETE",
    });
    if (!result.success) {
      throw new Error(result.message || "Session impossible à révoquer");
    }
  },

  async agencyContextOptions(): Promise<AgencyContextOption[]> {
    const result = await apiFetch<ApiResponse<AgencyContextOption[]>>(
      "/api/v1/auth/agency-context/options"
    );
    return result.data ?? [];
  },

  async enterAgencyContext(agencyId: string): Promise<AuthResponse> {
    const result = await apiFetch<ApiResponse<AuthResponse>>(
      `/api/v1/auth/agency-context/${agencyId}`,
      { method: "POST" }
    );
    saveAuth(result.data);
    return result.data;
  },

  async exitAgencyContext(): Promise<AuthResponse> {
    const result = await apiFetch<ApiResponse<AuthResponse>>(
      "/api/v1/auth/agency-context",
      { method: "DELETE" }
    );
    saveAuth(result.data);
    return result.data;
  },
};

async function loginErrorMessage(response: Response): Promise<string> {
  if (response.status === 401 || response.status === 403) {
    return "Email ou mot de passe incorrect";
  }
  if (response.status >= 500) {
    return "Service momentanément indisponible";
  }

  const errorData = await response.json().catch(() => ({}));
  return errorData.message || "Échec de la connexion";
}
