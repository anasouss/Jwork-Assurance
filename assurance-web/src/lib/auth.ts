import type { AuthResponse, AuthUser } from "@/lib/types";

let storedAuth: AuthResponse | null = null;
let authChannel: BroadcastChannel | null = null;

type AuthListener = (auth: AuthResponse | null) => void;
const authListeners = new Set<AuthListener>();

function applyAuth(auth: AuthResponse | null) {
  storedAuth = auth;
  authListeners.forEach((listener) => listener(storedAuth));
}

function getAuthChannel() {
  if (
    authChannel ||
    typeof window === "undefined" ||
    typeof BroadcastChannel === "undefined"
  ) {
    return authChannel;
  }
  authChannel = new BroadcastChannel("assurance-auth");
  authChannel.addEventListener("message", (event: MessageEvent<AuthResponse | null>) => {
    applyAuth(event.data);
  });
  return authChannel;
}

export function saveAuth(auth: AuthResponse) {
  applyAuth(auth);
  getAuthChannel()?.postMessage(auth);
}

export function clearAuth() {
  applyAuth(null);
  getAuthChannel()?.postMessage(null);
}

export function getAccessToken() {
  return storedAuth?.accessToken ?? null;
}

export function getStoredUser(): AuthUser | null {
  return storedAuth?.user ?? null;
}

export function getSessionId() {
  return storedAuth?.sessionId ?? null;
}

export function getStoredAuth(): AuthResponse | null {
  return storedAuth;
}

export function subscribeToAuth(listener: AuthListener) {
  authListeners.add(listener);
  getAuthChannel();
  return () => authListeners.delete(listener);
}
