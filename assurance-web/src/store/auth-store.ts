import { create } from "zustand";
import type { AuthUser } from "@/lib/types";
import { clearAuth, getAccessToken, getStoredUser, subscribeToAuth } from "@/lib/auth";
import { authApi } from "@/lib/api/auth";
import { queryClient } from "@/lib/query-client";

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  clearError: () => void;
};

let hydrationPromise: ReturnType<typeof authApi.refresh> | null = null;

function restoreSession() {
  if (!hydrationPromise) {
    hydrationPromise = authApi.refresh().finally(() => {
      hydrationPromise = null;
    });
  }
  return hydrationPromise;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  error: null,
  clearError: () => set({ error: null }),
  hydrate: async () => {
    set({ isLoading: true, error: null });
    const storedUser = getStoredUser();
    if (storedUser && getAccessToken()) {
      set({
        user: storedUser,
        isAuthenticated: true,
        isHydrated: true,
        isLoading: false,
      });
      return;
    }
    try {
      const auth = await restoreSession();
      set({
        user: auth.user,
        isAuthenticated: true,
        isHydrated: true,
        isLoading: false,
      });
    } catch {
      clearAuth();
      set({
        user: null,
        isAuthenticated: false,
        isHydrated: true,
        isLoading: false,
      });
    }
  },
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const auth = await authApi.login({ email, password });
      set({
        user: auth.user,
        isAuthenticated: true,
        isHydrated: true,
        isLoading: false,
      });
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Erreur réseau",
        isLoading: false,
      });
      return false;
    }
  },
  logout: async () => {
    await authApi.logout();
    set({ user: null, isAuthenticated: false, isHydrated: true });
  },
}));

subscribeToAuth((auth) => {
  if (!auth) {
    queryClient.clear();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isHydrated: true,
      isLoading: false,
    });
    return;
  }

  useAuthStore.setState({
    user: auth.user,
    isAuthenticated: true,
    isHydrated: true,
    isLoading: false,
    error: null,
  });
});
