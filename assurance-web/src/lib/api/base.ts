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
  const data = normalizeApiIds(await response.json()) as ApiResponse<AuthResponse>;
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

  if (response.status === 401 || response.status === 403) {
    let newToken: string;
    try {
      newToken = await getOrRefreshAccessToken();
    } catch (error) {
      void clearRefreshCookie();
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw error instanceof Error ? error : new Error("Session expired");
    }

    headers.set("Authorization", `Bearer ${newToken}`);
    const retry = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
    if (!retry.ok) {
      const errorData = await retry.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${retry.status}`);
    }
    return normalizeApiIds(await retry.json()) as T;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return normalizeApiIds(await response.json()) as T;
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

  if (response.status === 401 || response.status === 403) {
    let newToken: string;
    try {
      newToken = await getOrRefreshAccessToken();
    } catch (error) {
      void clearRefreshCookie();
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw error instanceof Error ? error : new Error("Session expired");
    }

    headers.set("Authorization", `Bearer ${newToken}`);
    const retry = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
    if (!retry.ok) {
      throw new Error(await responseErrorMessage(retry));
    }
    return await retry.blob();
  }

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  return await response.blob();
}

async function responseErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const errorData = await response.json().catch(() => ({}));
    return errorData.message || `HTTP ${response.status}`;
  }
  const text = await response.text().catch(() => "");
  return text || `HTTP ${response.status}`;
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

  return normalizeApiIds(await response.json()) as T;
}

export function normalizeApiIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeApiIds);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeApiEntry(key, entry)])
    );
  }
  return value;
}

function normalizeApiEntry(key: string, entry: unknown) {
  if (shouldNormalizeIdKey(key) && typeof entry === "number") {
    return String(entry);
  }
  if (key.endsWith("Ids") && Array.isArray(entry)) {
    return entry.map((item) => (typeof item === "number" ? String(item) : normalizeApiIds(item)));
  }
  return normalizeApiIds(entry);
}

function shouldNormalizeIdKey(key: string) {
  return key === "id" || key === "sessionId" || key.endsWith("Id") || key.endsWith("Ids");
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
