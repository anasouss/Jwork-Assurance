import { z } from 'zod';
import { normalizeIds } from '../lib/domain';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function apiBase() {
  const value = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!value) throw new ApiError('Adresse du serveur non configurée.', 0);
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/api/v1')) {
    throw new ApiError('Configuration du serveur invalide.', 0);
  }
  if (url.protocol !== 'https:' && !(typeof __DEV__ !== 'undefined' && __DEV__ && url.protocol === 'http:')) {
    throw new ApiError('Une connexion HTTPS est obligatoire.', 0);
  }
  return value;
}

const envelope = z.object({ success: z.boolean(), message: z.string().nullish(), data: z.unknown().optional() });
export async function requestRaw(path: string, options: {
  token?: string; body?: unknown; method?: 'GET' | 'POST'; signal?: AbortSignal; binary?: boolean;
} = {}) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new ApiError('Chemin non autorisé.', 0);
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 30_000);
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      method: options.method ?? 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: {
        Accept: options.binary ? '*/*' : 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const parsed = envelope.safeParse(body);
      const fallback = response.status === 401 ? 'Votre session a expiré. Reconnectez-vous.'
        : response.status === 403 ? 'Cet accès n’est pas autorisé ou n’est plus disponible.'
          : response.status === 404 ? 'Ce dossier ou document n’est plus disponible.' : 'Le serveur est indisponible. Réessayez.';
      throw new ApiError(parsed.success && parsed.data.message ? parsed.data.message : fallback, response.status);
    }
    if (options.binary) {
      const length = Number(response.headers.get('Content-Length') ?? 0);
      if (length > 32 * 1024 * 1024) throw new ApiError('Ce document est trop volumineux.', 413);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 32 * 1024 * 1024) throw new ApiError('Ce document est trop volumineux.', 413);
      return { bytes, contentType: response.headers.get('Content-Type') ?? '' };
    }
    if (response.status === 204) return null;
    const parsed = envelope.safeParse(await response.json());
    if (!parsed.success) throw new ApiError('Réponse serveur invalide. Réessayez plus tard.', 502);
    if (!parsed.data.success) throw new ApiError(parsed.data.message ?? 'La demande a échoué.', 400);
    return normalizeIds(parsed.data.data ?? null);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw error;
    throw new ApiError('Connexion impossible. Vérifiez votre réseau et réessayez.', 0);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

export function queryString(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  return query.size ? `?${query}` : '';
}
