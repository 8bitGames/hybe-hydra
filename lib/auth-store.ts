"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { api, authApi, usersApi } from "./api";

// Create Supabase client for client-side auth operations
// Enable autoRefreshToken to automatically refresh sessions before expiry
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

// Session refresh interval (check every 4 minutes)
const SESSION_CHECK_INTERVAL = 4 * 60 * 1000;
let sessionCheckInterval: NodeJS.Timeout | null = null;
let visibilityChangeHandler: (() => void) | null = null;
let isSessionMonitorRunning = false; // Prevent duplicate monitor starts

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

  // Session management
  initializeSession: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  startSessionMonitor: () => void;
  stopSessionMonitor: () => void;
  checkSessionOnVisibility: () => Promise<void>;
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
          console.log("[AuthStore] Login successful, setting token...", {
            hasAccessToken: !!access_token,
            hasUser: !!user,
          });

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
            console.log("[AuthStore] State set with user, current state:", {
              accessToken: !!get().accessToken,
              isAuthenticated: get().isAuthenticated,
              user: !!get().user,
            });
          } else {
            set({
              accessToken: access_token,
              refreshToken: refresh_token,
              isAuthenticated: true,
              isLoading: false,
            });
            console.log("[AuthStore] State set, fetching user...");

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
        // Stop session monitoring first
        get().stopSessionMonitor();

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

      // Initialize session - called once on app load
      initializeSession: async () => {
        console.log("[AuthStore] Initializing session...");

        try {
          // Get current Supabase session
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            console.error("[AuthStore] Error getting session:", error);
            return;
          }

          if (session) {
            console.log("[AuthStore] Found existing Supabase session, syncing tokens...");
            const { accessToken, refreshToken } = get();

            // If we have a Supabase session but our store is out of sync, update it
            if (session.access_token !== accessToken) {
              console.log("[AuthStore] Syncing tokens from Supabase session");
              api.setAccessToken(session.access_token);
              set({
                accessToken: session.access_token,
                refreshToken: session.refresh_token,
                isAuthenticated: true,
              });

              // Fetch user if we don't have it
              if (!get().user) {
                await get().fetchUser();
              }
            }
          }

          // Start session monitoring
          get().startSessionMonitor();
        } catch (error) {
          console.error("[AuthStore] Session initialization error:", error);
        }
      },

      // Manually refresh the session using backend API
      refreshSession: async () => {
        console.log("[AuthStore] Refreshing session...");

        try {
          const { refreshToken } = get();

          if (!refreshToken) {
            console.error("[AuthStore] No refresh token available");
            return false;
          }

          // Use backend API for token refresh
          const refreshResponse = await authApi.refresh(refreshToken);

          if (refreshResponse.data) {
            console.log("[AuthStore] Session refreshed successfully via backend API");
            api.setAccessToken(refreshResponse.data.access_token);
            set({
              accessToken: refreshResponse.data.access_token,
              refreshToken: refreshResponse.data.refresh_token,
            });
            return true;
          }

          console.error("[AuthStore] Session refresh failed:", refreshResponse.error);
          return false;
        } catch (error) {
          console.error("[AuthStore] Session refresh error:", error);
          return false;
        }
      },

      // Check session when tab becomes visible
      checkSessionOnVisibility: async () => {
        const { isAuthenticated, accessToken } = get();

        if (!isAuthenticated || !accessToken) {
          console.log("[AuthStore] Visibility check: Not authenticated, skipping");
          return;
        }

        console.log("[AuthStore] Tab became visible, checking session...");

        try {
          // Verify session by calling backend API
          api.setAccessToken(accessToken);
          const response = await usersApi.getMe();

          if (response.error) {
            console.warn("[AuthStore] Visibility check: Token invalid, attempting refresh...");

            // Try to refresh the token
            const refreshed = await get().refreshSession();

            if (refreshed) {
              console.log("[AuthStore] Visibility check: Token refreshed successfully");
              // Fetch fresh user data
              await get().fetchUser();
            } else {
              console.log("[AuthStore] Visibility check: Refresh failed, logging out");
              get().logout();
            }
          } else {
            console.log("[AuthStore] Visibility check: Session is valid");
            // Update user data if returned
            if (response.data) {
              set({ user: response.data });
            }
          }
        } catch (error) {
          console.error("[AuthStore] Visibility check error:", error);
        }
      },

      // Start periodic session monitoring
      startSessionMonitor: () => {
        if (typeof window === "undefined") return;

        // Prevent duplicate monitor starts
        if (isSessionMonitorRunning) {
          console.log("[AuthStore] Session monitor already running, skipping...");
          return;
        }

        // Clear existing interval if any (just in case)
        if (sessionCheckInterval) {
          clearInterval(sessionCheckInterval);
        }

        // Remove existing visibility change handler if any
        if (visibilityChangeHandler) {
          document.removeEventListener("visibilitychange", visibilityChangeHandler);
        }

        isSessionMonitorRunning = true;
        console.log("[AuthStore] Starting session monitor (every 4 minutes + visibility check)");

        // Set up visibility change listener for when tab becomes active
        visibilityChangeHandler = () => {
          if (document.visibilityState === "visible") {
            get().checkSessionOnVisibility();
          }
        };
        document.addEventListener("visibilitychange", visibilityChangeHandler);

        // Set up Supabase auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event: AuthChangeEvent, session: Session | null) => {
            console.log("[AuthStore] Auth state changed:", event, { hasSession: !!session });

            if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
              if (event === "TOKEN_REFRESHED" && session) {
                // Session was automatically refreshed - update our store
                console.log("[AuthStore] Token auto-refreshed by Supabase");
                api.setAccessToken(session.access_token);
                set({
                  accessToken: session.access_token,
                  refreshToken: session.refresh_token,
                });
              } else if (event === "SIGNED_OUT") {
                // User signed out - clear our store
                console.log("[AuthStore] User signed out, clearing session");
                get().logout();
              }
            }
          }
        );

        // Store subscription for cleanup
        (window as any).__supabaseAuthSubscription = subscription;

        // Periodic session check using backend API
        sessionCheckInterval = setInterval(async () => {
          const { isAuthenticated, accessToken } = get();

          if (!isAuthenticated || !accessToken) {
            console.log("[AuthStore] Session check: Not authenticated, skipping");
            return;
          }

          console.log("[AuthStore] Session check: Verifying session validity...");

          try {
            // Verify session by calling backend API
            api.setAccessToken(accessToken);
            const response = await usersApi.getMe();

            if (response.error) {
              console.warn("[AuthStore] Session check: Session invalid or expired");

              // Try to refresh
              const refreshed = await get().refreshSession();
              if (!refreshed) {
                console.log("[AuthStore] Session check: Refresh failed, logging out");
                get().logout();
              }
            } else {
              console.log("[AuthStore] Session check: Session is valid");
              // Update user data if returned
              if (response.data) {
                set({ user: response.data });
              }
            }
          } catch (error) {
            console.error("[AuthStore] Session check error:", error);
          }
        }, SESSION_CHECK_INTERVAL);
      },

      // Stop session monitoring
      stopSessionMonitor: () => {
        if (!isSessionMonitorRunning) {
          return; // Already stopped
        }

        console.log("[AuthStore] Stopping session monitor");
        isSessionMonitorRunning = false;

        if (sessionCheckInterval) {
          clearInterval(sessionCheckInterval);
          sessionCheckInterval = null;
        }

        // Remove visibility change listener
        if (visibilityChangeHandler) {
          document.removeEventListener("visibilitychange", visibilityChangeHandler);
          visibilityChangeHandler = null;
        }

        // Unsubscribe from Supabase auth changes
        if (typeof window !== "undefined" && (window as any).__supabaseAuthSubscription) {
          (window as any).__supabaseAuthSubscription.unsubscribe();
          (window as any).__supabaseAuthSubscription = null;
        }
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
