import { create } from "zustand";
import type { AuthUser } from "@/lib/types";
import { clearAuth, getAccessToken, getStoredUser } from "@/lib/auth";
import { authApi } from "@/lib/api/auth";

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
  updateUserLanguage: (language: string) => void;
  markOnboardingComplete: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  error: null,
  clearError: () => set({ error: null }),
  updateUserLanguage: (language: string) => {
    set((state) => {
      if (state.user) {
        return { user: { ...state.user, language } };
      }
      return state;
    });
  },
  markOnboardingComplete: () => {
    set((state) => ({
      user: state.user ? { ...state.user, onboardingCompleted: true } : null,
    }));
  },
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
      const auth = await authApi.refresh();
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
    clearAuth();
    set({ user: null, isAuthenticated: false });
  },
}));
