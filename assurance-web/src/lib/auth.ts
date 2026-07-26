import type { AuthResponse, AuthUser } from "@/lib/types";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let storedUser: AuthUser | null = null;
let sessionId: string | null = null;
const STORAGE_KEY = "assurance_auth";

export function saveAuth(auth: AuthResponse) {
  accessToken = auth.accessToken;
  refreshToken = auth.refreshToken ?? refreshToken;
  storedUser = auth.user ?? null;
  sessionId = auth.sessionId == null ? null : String(auth.sessionId);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accessToken,
      refreshToken,
      storedUser,
      sessionId,
    })
  );
}

export function clearAuth() {
  accessToken = null;
  refreshToken = null;
  storedUser = null;
  sessionId = null;
  localStorage.removeItem(STORAGE_KEY);
}

export function getAccessToken() {
  hydrateAuthFromStorage();
  return accessToken;
}

export function getRefreshToken() {
  hydrateAuthFromStorage();
  return refreshToken;
}

export function getStoredUser(): AuthUser | null {
  hydrateAuthFromStorage();
  return storedUser;
}

export function getSessionId() {
  hydrateAuthFromStorage();
  return sessionId;
}

export function hydrateAuthFromStorage() {
  if (accessToken || storedUser) {
    return;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw) as {
      accessToken?: string | null;
      refreshToken?: string | null;
      storedUser?: AuthUser | null;
      sessionId?: string | null;
    };
    accessToken = parsed.accessToken ?? null;
    refreshToken = parsed.refreshToken ?? null;
    storedUser = parsed.storedUser ?? null;
    sessionId = parsed.sessionId ?? null;
  } catch {
    clearAuth();
  }
}
