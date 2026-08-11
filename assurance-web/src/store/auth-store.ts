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
  isSwitchingContext: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  enterAgencyContext: (agencyId: string) => Promise<void>;
  exitAgencyContext: () => Promise<void>;
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
  isSwitchingContext: false,
  error: null,
  clearError: () => set({ error: null }),
  hydrate: async () => {
    set({ isLoading: true, error: null });
    const storedUser = getStoredUser();
    const hasCurrentAuthShape = storedUser
      && typeof storedUser.platformAdmin === "boolean"
      && (storedUser.operatingMode === "PLATFORM" || storedUser.operatingMode === "AGENCY");
    if (hasCurrentAuthShape && getAccessToken()) {
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
  enterAgencyContext: async (agencyId) => {
    set({ isSwitchingContext: true, error: null });
    try {
      const auth = await authApi.enterAgencyContext(agencyId);
      queryClient.clear();
      set({ user: auth.user, isSwitchingContext: false });
    } catch (error) {
      set({
        isSwitchingContext: false,
        error: error instanceof Error ? error.message : "Contexte agence impossible à activer",
      });
      throw error;
    }
  },
  exitAgencyContext: async () => {
    set({ isSwitchingContext: true, error: null });
    try {
      const auth = await authApi.exitAgencyContext();
      queryClient.clear();
      set({ user: auth.user, isSwitchingContext: false });
    } catch (error) {
      set({
        isSwitchingContext: false,
        error: error instanceof Error ? error.message : "Retour à la plateforme impossible",
      });
      throw error;
    }
  },
}));

subscribeToAuth((auth) => {
  const previousAgencyId = useAuthStore.getState().user?.agenceId ?? null;
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

  if (previousAgencyId !== auth.user.agenceId) {
    queryClient.clear();
  }

  useAuthStore.setState({
    user: auth.user,
    isAuthenticated: true,
    isHydrated: true,
    isLoading: false,
    error: null,
  });
});
