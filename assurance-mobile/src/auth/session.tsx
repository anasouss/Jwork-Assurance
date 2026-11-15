import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, requestRaw } from '../api/transport';
import { clientTokens, mobileLogin, staffTokens, type Profile, type User } from '../api/schemas';

type Kind = 'client' | 'staff';
export type Session = {
  kind: Kind; space: 'client' | 'staff' | 'platform'; accessToken: string;
  refreshToken: string; expiresAt: number; profile?: Profile; user?: User;
};
const savedSession = z.object({ kind: z.enum(['client', 'staff']), refreshToken: z.string().min(1) });
const key = 'assurance.mobile.session.v1';
const storage = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
function authPath(kind: Kind) { return kind === 'client' ? '/client-portal/auth' : '/mobile/auth'; }
function decode(kind: Kind, data: unknown): Session {
  if (kind === 'client') {
    const value = clientTokens.parse(data);
    return { kind, space: 'client', ...value, expiresAt: Date.now() + value.expiresIn * 1000 };
  }
  const value = staffTokens.parse(data);
  if (value.auth.user.operatingMode === 'PLATFORM' && !value.auth.user.platformAdmin) {
    throw new ApiError('Aucun espace autorisé pour ce compte.', 403);
  }
  return {
    kind, space: value.auth.user.platformAdmin && value.auth.user.operatingMode === 'PLATFORM' ? 'platform' : 'staff',
    accessToken: value.auth.accessToken, refreshToken: value.refreshToken,
    user: value.auth.user, expiresAt: Date.now() + value.auth.expiresIn * 1000,
  };
}
type SessionContext = {
  session: Session | null; restoring: boolean; restoreError: string | null;
  restore: () => Promise<void>;
  login: (identifiant: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  get: <T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal) => Promise<T>;
  binary: (path: string) => Promise<{ bytes: Uint8Array; contentType: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};
const Context = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const current = useRef<Session | null>(null);
  const epoch = useRef(0);
  const refreshing = useRef<Promise<Session> | null>(null);
  const restoringSession = useRef<Promise<void> | null>(null);
  // Serialize keychain writes: a stale refresh must never restore a logged-out session.
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  function write(value: Session | null) {
    const operation = writes.current.catch(() => {}).then(() => value
      ? SecureStore.setItemAsync(key, JSON.stringify({ kind: value.kind, refreshToken: value.refreshToken }), storage)
      : SecureStore.deleteItemAsync(key));
    writes.current = operation;
    return operation;
  }
  function publish(value: Session | null) { current.current = value; setSession(value); }
  async function clear() {
    epoch.current += 1;
    refreshing.current = null;
    publish(null);
    setRestoreError(null);
    queryClient.clear();
    await write(null);
  }
  async function save(value: Session, version: number) {
    if (version !== epoch.current) throw new ApiError('La session a changé.', 401);
    await write(value);
    if (version !== epoch.current) throw new ApiError('La session a changé.', 401);
    publish(value);
    return value;
  }
  async function refresh() {
    if (refreshing.current) return refreshing.current;
    const previous = current.current;
    if (!previous) throw new ApiError('Reconnectez-vous pour continuer.', 401);
    const version = epoch.current;
    const promise = (async () => {
      try {
        const data = await requestRaw(`${authPath(previous.kind)}/refresh`, {
          method: 'POST', body: { refreshToken: previous.refreshToken },
        });
        const next = decode(previous.kind, data);
        if (next.space !== previous.space) queryClient.clear();
        try { return await save(next, version); }
        catch (error) {
          await requestRaw(`${authPath(next.kind)}/logout`, { method: 'POST', body: { refreshToken: next.refreshToken } }).catch(() => {});
          throw error;
        }
      } catch (error) {
        if (version === epoch.current && error instanceof ApiError && [401, 403].includes(error.status)) await clear();
        throw error;
      }
    })();
    refreshing.current = promise;
    try { return await promise; } finally { if (refreshing.current === promise) refreshing.current = null; }
  }
  async function authenticated(path: string, options: { method?: 'POST'; body?: unknown; signal?: AbortSignal; binary?: boolean } = {}) {
    const version = epoch.current;
    let active = current.current;
    if (!active) throw new ApiError('Reconnectez-vous pour continuer.', 401);
    if (active.expiresAt <= Date.now() + 30_000) active = await refresh();
    let result: unknown;
    try {
      result = await requestRaw(path, { ...options, token: active.accessToken });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || epoch.current !== version) throw error;
      // Another request may already have refreshed the access token.
      const renewed = current.current?.accessToken !== active.accessToken ? current.current : await refresh();
      if (!renewed || epoch.current !== version) throw error;
      try { result = await requestRaw(path, { ...options, token: renewed.accessToken }); }
      catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401 && epoch.current === version) await clear();
        throw retryError;
      }
    }
    if (epoch.current !== version) throw new ApiError('La session a changé.', 401);
    return result;
  }
  async function performRestore() {
    setRestoring(true);
    setRestoreError(null);
    const version = epoch.current;
    try {
      const stored = await SecureStore.getItemAsync(key);
      if (!stored) return;
      let decoded: unknown;
      try { decoded = JSON.parse(stored); } catch { await clear(); return; }
      const parsed = savedSession.safeParse(decoded);
      if (!parsed.success) { await clear(); return; }
      const data = await requestRaw(`${authPath(parsed.data.kind)}/refresh`, { method: 'POST', body: { refreshToken: parsed.data.refreshToken } });
      await save(decode(parsed.data.kind, data), version);
    } catch (error) {
      if (version === epoch.current && error instanceof ApiError && [401, 403].includes(error.status)) await clear();
      else if (version === epoch.current) setRestoreError(error instanceof Error ? error.message : 'La session ne peut pas être restaurée.');
    } finally { setRestoring(false); }
  }
  async function restore() {
    if (restoringSession.current) return restoringSession.current;
    const operation = performRestore();
    restoringSession.current = operation;
    try { await operation; } finally { if (restoringSession.current === operation) restoringSession.current = null; }
  }
  useEffect(() => { void restore(); }, []);

  const value: SessionContext = {
    session, restoring, restoreError, restore,
    async login(identifiant, password) {
      const version = ++epoch.current;
      queryClient.clear();
      const data = await requestRaw('/mobile/auth/sign-in', { method: 'POST', body: { identifiant, password } });
      const result = mobileLogin.safeParse(data);
      if (!result.success) throw new ApiError('La réponse de connexion est incompatible avec cette version.', 502);
      const next = result.data.principalType === 'CLIENT' ? decode('client', result.data.client) : decode('staff', result.data.staff);
      try { await save(next, version); }
      catch (error) {
        await requestRaw(`${authPath(next.kind)}/logout`, { method: 'POST', body: { refreshToken: next.refreshToken } }).catch(() => {});
        if (version === epoch.current) await clear();
        throw error;
      }
    },
    async logout() {
      const previous = current.current;
      try { await clear(); }
      finally {
        if (previous) {
          await requestRaw(`${authPath(previous.kind)}/logout`, { method: 'POST', body: { refreshToken: previous.refreshToken } });
        }
      }
    },
    async get(path, schema, signal) {
      const result = schema.safeParse(await authenticated(path, { signal }));
      if (!result.success) throw new ApiError('Les données reçues sont incompatibles avec cette version.', 502);
      return result.data;
    },
    async binary(path) {
      return await authenticated(path, { binary: true }) as { bytes: Uint8Array; contentType: string };
    },
    async changePassword(currentPassword, newPassword) {
      const active = current.current;
      if (!active) throw new ApiError('Reconnectez-vous.', 401);
      await authenticated(active.kind === 'client' ? '/client-portal/auth/password' : '/auth/password', {
        method: 'POST', body: { currentPassword, newPassword },
      });
      await clear();
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider absent');
  return value;
}
