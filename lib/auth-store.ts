"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@supabase/supabase-js";
import { api, authApi, usersApi } from "./api";

// Create Supabase client for client-side auth operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  label_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  _hasHydrated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setHasHydrated: (state: boolean) => void;
}

// Setup global auth:logout event listener
if (typeof window !== "undefined") {
  window.addEventListener("auth:logout", () => {
    console.log("[Auth] Received logout event from API client");
    useAuthStore.getState().logout();
  });
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      isAuthenticated: false,
      _hasHydrated: false,

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true });

        const response = await authApi.login({ email, password });

        if (response.error) {
          set({ isLoading: false });
          return { success: false, error: response.error.message };
        }

        if (response.data) {
          const { access_token, refresh_token, user } = response.data;
          console.log("[AuthStore] Login successful, setting token...");

          // Set token in API client
          api.setAccessToken(access_token);

          // If user data is included in login response, use it directly
          if (user) {
            set({
              accessToken: access_token,
              refreshToken: refresh_token,
              isAuthenticated: true,
              isLoading: false,
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                label_ids: user.label_ids || [],
                is_active: true,
                created_at: "",
                updated_at: "",
              },
            });
          } else {
            set({
              accessToken: access_token,
              refreshToken: refresh_token,
              isAuthenticated: true,
              isLoading: false,
            });

            // Fetch user info if not included in response
            await get().fetchUser();
          }

          return { success: true };
        }

        set({ isLoading: false });
        return { success: false, error: "Unknown error" };
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true });

        const response = await authApi.register({ email, password, name });

        if (response.error) {
          set({ isLoading: false });
          return { success: false, error: response.error.message };
        }

        set({ isLoading: false });

        // Auto login after registration
        return get().login(email, password);
      },

      logout: async () => {
        // Sign out from Supabase
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.error("[Auth] Supabase signOut error:", error);
        }

        api.setAccessToken(null);
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      fetchUser: async () => {
        const { accessToken } = get();

        if (!accessToken) {
          return;
        }

        // Ensure token is set in API client
        api.setAccessToken(accessToken);

        const response = await usersApi.getMe();

        if (response.error) {
          // Token might be expired, try to refresh
          const { refreshToken } = get();
          if (refreshToken) {
            const refreshResponse = await authApi.refresh(refreshToken);
            if (refreshResponse.data) {
              api.setAccessToken(refreshResponse.data.access_token);
              set({
                accessToken: refreshResponse.data.access_token,
                refreshToken: refreshResponse.data.refresh_token,
              });
              // Retry fetching user
              const retryResponse = await usersApi.getMe();
              if (retryResponse.data) {
                set({ user: retryResponse.data, isAuthenticated: true });
              }
            } else {
              // Refresh failed, logout
              get().logout();
            }
          } else {
            get().logout();
          }
          return;
        }

        if (response.data) {
          set({ user: response.data, isAuthenticated: true });
        }
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        api.setAccessToken(accessToken);
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },
    }),
    {
      name: "hydra-auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
      onRehydrateStorage: () => {
        // This function is called BEFORE hydration with the initial state
        // It returns a callback that's called AFTER hydration
        return (hydratedState, error: unknown) => {
          console.log("[AuthStore] Rehydration complete:", {
            hasToken: !!hydratedState?.accessToken,
            isAuthenticated: hydratedState?.isAuthenticated,
            error: error instanceof Error ? error.message : error
          });
          if (error) {
            console.error("[AuthStore] Rehydration error:", error);
          }
          // 복원된 토큰을 API 클라이언트에 설정
          if (hydratedState?.accessToken) {
            api.setAccessToken(hydratedState.accessToken);
          }
          // Hydration 완료 표시 - use the setter from hydrated state
          if (hydratedState?.setHasHydrated) {
            hydratedState.setHasHydrated(true);
            console.log("[AuthStore] _hasHydrated set to true via setter");
          }
        };
      },
    }
  )
);
