import type { ApiResponse, AuthResponse, AuthSession } from "@/lib/types";
import { API_BASE_URL, apiFetch, normalizeApiIds } from "./base";
import { clearAuth, getRefreshToken, saveAuth } from "@/lib/auth";

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
        headers: { "Content-Type": "application/json" },
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

    const auth = normalizeAuthResponse(result.data);
    saveAuth(auth);
    return auth;
  },

  async refresh(): Promise<AuthResponse> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error("Aucune session enregistree");
    }
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Échec du rafraîchissement");
    }

    const result = normalizeApiIds(await response.json()) as ApiResponse<AuthResponse>;
    if (!result.success) {
      throw new Error(result.message || "Échec du rafraîchissement");
    }

    const auth = normalizeAuthResponse(result.data);
    saveAuth(auth);
    return auth;
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: getRefreshToken() }),
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

function normalizeAuthResponse(auth: AuthResponse): AuthResponse {
  const fullName = auth.user.fullName || [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ") || auth.user.email;
  const [firstName = fullName, ...rest] = fullName.split(" ");
  return {
    ...auth,
    user: {
      ...auth.user,
      firstName: auth.user.firstName ?? firstName,
      lastName: auth.user.lastName ?? rest.join(" "),
      fullName,
      roleName: auth.user.roleName ?? auth.user.roleCode,
      permissions: auth.user.permissions ?? [],
      language: "fr",
      onboardingCompleted: true,
      clientPortalEnabled: false,
    },
  };
}
