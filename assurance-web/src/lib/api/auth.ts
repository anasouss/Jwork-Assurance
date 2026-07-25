import type { ApiResponse, AuthResponse } from "@/lib/types";
import { API_BASE_URL } from "./base";
import { clearAuth, getRefreshToken, saveAuth } from "@/lib/auth";

export type LoginRequest = {
  email: string;
  password: string;
};

export const authApi = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Échec de la connexion");
    }

    const result = (await response.json()) as ApiResponse<AuthResponse>;
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

    const result = (await response.json()) as ApiResponse<AuthResponse>;
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
};

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
