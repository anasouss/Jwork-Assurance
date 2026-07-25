import type { ApiResponse, AuthResponse } from "@/lib/types";
import { clearAuth, getAccessToken, getRefreshToken, saveAuth } from "@/lib/auth";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8080";

let refreshPromise: Promise<string> | null = null;

async function clearRefreshCookie(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: getRefreshToken() }),
  }).catch(() => {});
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("Refresh token missing");
  }
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    throw new Error("Refresh failed");
  }
  const data = (await response.json()) as ApiResponse<AuthResponse>;
  if (!data.success) {
    throw new Error(data.message ?? "Refresh failed");
  }
  saveAuth(data.data);
  return data.data.accessToken;
}

async function getOrRefreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  headers.set("Accept-Language", "fr");
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    try {
      const newToken = await getOrRefreshAccessToken();
      headers.set("Authorization", `Bearer ${newToken}`);
      const retry = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
      });
      if (!retry.ok) {
        const errorData = await retry.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${retry.status}`);
      }
      return (await retry.json()) as T;
    } catch {
      void clearRefreshCookie();
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Session expired");
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function apiFetchBlob(
  path: string,
  options: RequestInit = {}
): Promise<Blob> {
  const headers = new Headers(options.headers);
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  headers.set("Accept-Language", "fr");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    try {
      const newToken = await getOrRefreshAccessToken();
      headers.set("Authorization", `Bearer ${newToken}`);
      const retry = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
      });
      if (!retry.ok) {
        throw new Error(`HTTP ${retry.status}`);
      }
      return await retry.blob();
    } catch {
      void clearRefreshCookie();
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Session expired");
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.blob();
}

export async function apiUpload<T>(
  path: string,
  formData: FormData
): Promise<T> {
  const headers = new Headers();
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  headers.set("Accept-Language", "fr");
  // Don't set Content-Type for FormData - browser will set it with boundary

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch (error) {
    throw toUploadNetworkError(error);
  }

  if (response.status === 401) {
    try {
      const newToken = await getOrRefreshAccessToken();
      headers.set("Authorization", `Bearer ${newToken}`);
      let retry: Response;
      try {
        retry = await fetch(`${API_BASE_URL}${path}`, {
          method: "POST",
          headers,
          body: formData,
        });
      } catch (error) {
        throw toUploadNetworkError(error);
      }
      if (!retry.ok) {
        const errorData = await retry.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${retry.status}`);
      }
      return (await retry.json()) as T;
    } catch {
      void clearRefreshCookie();
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Session expired");
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function toUploadNetworkError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("failed to fetch") || message.includes("networkerror")) {
      return new Error(
        "Connexion interrompue pendant le dépôt. Vérifiez votre réseau et réessayez."
      );
    }
    return error;
  }
  return new Error(
    "Connexion interrompue pendant le dépôt. Vérifiez votre réseau et réessayez."
  );
}

// Helper to build query string from params
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}
