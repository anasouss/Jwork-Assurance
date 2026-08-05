import type { ApiResponse, AuthResponse } from "@/lib/types";
import { clearAuth, getAccessToken, getStoredAuth, saveAuth } from "@/lib/auth";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8080";

let refreshPromise: Promise<AuthResponse> | null = null;

const AUTH_REQUEST_HEADERS = { "X-Auth-Request": "1" } as const;

type NetworkErrorMapper = (error: unknown) => Error;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function clearRefreshCookie(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
    method: "DELETE",
    credentials: "include",
    headers: AUTH_REQUEST_HEADERS,
  }).catch(() => {});
}

async function requestRefreshedSession(): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: AUTH_REQUEST_HEADERS,
  });
  if (!response.ok) {
    throw new Error("Refresh failed");
  }
  const data = normalizeApiIds(await response.json()) as ApiResponse<AuthResponse>;
  if (!data.success) {
    throw new Error(data.message ?? "Refresh failed");
  }
  saveAuth(data.data);
  return data.data;
}

async function withRefreshLock<T>(callback: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("assurance-refresh-session", callback);
  }
  return callback();
}

export async function refreshAuthSession(): Promise<AuthResponse> {
  if (!refreshPromise) {
    const tokenBeforeLock = getAccessToken();
    refreshPromise = withRefreshLock(async () => {
      const currentAuth = getStoredAuth();
      if (currentAuth && currentAuth.accessToken !== tokenBeforeLock) {
        return currentAuth;
      }
      return requestRefreshedSession();
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authenticatedRequest(path, options);
  if (!response.ok) {
    throw await responseError(response);
  }
  if (response.status === 204) return undefined as T;
  return normalizeApiIds(await response.json()) as T;
}

export async function apiFetchBlob(
  path: string,
  options: RequestInit = {}
): Promise<Blob> {
  const response = await authenticatedRequest(path, options);
  if (!response.ok) {
    throw await responseError(response);
  }
  return await response.blob();
}

async function responseError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const errorData = await response.json().catch(() => ({})) as { message?: string; code?: string };
    return new ApiError(errorData.message || `HTTP ${response.status}`, response.status, errorData.code);
  }
  const text = await response.text().catch(() => "");
  return new ApiError(text || `HTTP ${response.status}`, response.status);
}

export async function apiUpload<T>(
  path: string,
  formData: FormData
): Promise<T> {
  const response = await authenticatedRequest(
    path,
    {
      method: "POST",
      body: formData,
    },
    toUploadNetworkError
  );
  if (!response.ok) {
    throw await responseError(response);
  }
  if (response.status === 204) return undefined as T;
  return normalizeApiIds(await response.json()) as T;
}

async function authenticatedRequest(
  path: string,
  options: RequestInit,
  mapNetworkError?: NetworkErrorMapper
): Promise<Response> {
  const requestToken = getAccessToken();
  let response = await executeRequest(path, options, requestToken, mapNetworkError);
  if (response.status !== 401) return response;

  const latestToken = getAccessToken();
  if (latestToken && latestToken !== requestToken) {
    response = await executeRequest(path, options, latestToken, mapNetworkError);
    if (response.status !== 401) return response;
  }

  let session: AuthResponse;
  try {
    session = await refreshAuthSession();
  } catch (error) {
    expireBrowserSession();
    throw error instanceof Error ? error : new Error("Session expired");
  }

  response = await executeRequest(path, options, session.accessToken, mapNetworkError);
  if (response.status === 401) {
    expireBrowserSession();
  }
  return response;
}

async function executeRequest(
  path: string,
  options: RequestInit,
  accessToken: string | null,
  mapNetworkError?: NetworkErrorMapper
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Accept-Language", "fr");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (error) {
    throw mapNetworkError ? mapNetworkError(error) : error;
  }
}

function expireBrowserSession() {
  void clearRefreshCookie();
  clearAuth();
  if (typeof window !== "undefined") window.location.href = "/login";
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
