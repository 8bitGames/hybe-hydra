"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";

/**
 * Auth Store - Cookie-based authentication with in-memory token access
 *
 * This store:
 * - Uses Supabase SSR cookies for auth (primary)
 * - Keeps accessToken in memory for components that need it (NOT persisted)
 * - Persists only user profile to localStorage
 * - Works with the unified middleware for session management
 *
 * NOTE: accessToken is available in memory for backward compatibility
 * but is NOT persisted to localStorage. Components should migrate to
 * using `credentials: 'include'` for API calls.
 */

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
  isLoading: boolean;
  isAuthenticated: boolean;
  _hasHydrated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setHasHydrated: (state: boolean) => void;
  initializeSession: () => Promise<void>;
  syncTokenFromSession: () => Promise<void>;

  // Token properties - kept in memory (NOT persisted) for backward compatibility
  // Components should migrate to using `credentials: 'include'` instead
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;

  // Legacy methods - kept for backward compatibility (no-op or minimal implementation)
  startSessionMonitor: () => void;
  stopSessionMonitor: () => void;
  setTokens: (accessToken: string, refreshToken: string, expiresIn?: number) => void;
  refreshSession: () => Promise<boolean>;
  checkSessionOnVisibility: () => Promise<void>;
}

// Create Supabase client for auth operations
const getSupabase = () => createClient();

// Track auth subscription to prevent memory leaks
// Stored outside Zustand to avoid persistence issues
let authSubscription: { unsubscribe: () => void } | null = null;

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
      isLoading: false,
      isAuthenticated: false,
      _hasHydrated: false,

      // Token properties - kept in memory for backward compatibility
      // NOT persisted to localStorage - synced from Supabase session
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true });

        try {
          // Use our backend API which sets cookies properly
          const response = await fetch("/api/v1/auth/login", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            set({ isLoading: false });
            return { success: false, error: data.detail || "Login failed" };
          }

          // Calculate token expiry (default 1 hour if not provided)
          const expiresIn = data.expires_in || 3600;
          const tokenExpiresAt = Date.now() + expiresIn * 1000;

          // Set user and tokens from API response
          if (data.user) {
            set({
              isAuthenticated: true,
              isLoading: false,
              accessToken: data.access_token || null,
              refreshToken: data.refresh_token || null,
              tokenExpiresAt,
              user: {
                id: data.user.id,
                email: data.user.email,
                name: data.user.name,
                role: data.user.role,
                label_ids: data.user.label_ids || [],
                is_active: true,
                created_at: "",
                updated_at: "",
              },
            });
          } else {
            set({
              isAuthenticated: true,
              isLoading: false,
              accessToken: data.access_token || null,
              refreshToken: data.refresh_token || null,
              tokenExpiresAt,
            });
            await get().fetchUser();
          }

          return { success: true };
        } catch (error) {
          console.error("[AuthStore] Login error:", error);
          set({ isLoading: false });
          return { success: false, error: "Network error" };
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true });

        try {
          const response = await fetch("/api/v1/auth/register", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, name }),
          });

          const data = await response.json();

          if (!response.ok) {
            set({ isLoading: false });
            return { success: false, error: data.detail || "Registration failed" };
          }

          set({ isLoading: false });

          // Auto login after registration
          return get().login(email, password);
        } catch (error) {
          console.error("[AuthStore] Registration error:", error);
          set({ isLoading: false });
          return { success: false, error: "Network error" };
        }
      },

      logout: async () => {
        // Unsubscribe from auth state changes to prevent memory leaks
        if (authSubscription) {
          authSubscription.unsubscribe();
          authSubscription = null;
        }

        try {
          // Sign out from Supabase (clears cookies)
          const supabase = getSupabase();
          await supabase.auth.signOut();

          // Also call our backend for clean logout
          await fetch("/api/v1/auth/logout", {
            method: "POST",
            credentials: "include",
          }).catch(() => {});
        } catch (error) {
          console.error("[Auth] Logout error:", error);
        }

        set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
        });
      },

      fetchUser: async () => {
        try {
          const response = await fetch("/api/v1/users/me", {
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });

          if (!response.ok) {
            if (response.status === 401) {
              // Session expired
              set({ user: null, isAuthenticated: false });
            }
            return;
          }

          const data = await response.json();
          set({ user: data, isAuthenticated: true });
        } catch (error) {
          console.error("[AuthStore] fetchUser error:", error);
        }
      },

      initializeSession: async () => {
        console.log("[AuthStore] Initializing session...");

        try {
          const supabase = getSupabase();

          // Unsubscribe from any existing listener to prevent memory leaks
          if (authSubscription) {
            authSubscription.unsubscribe();
            authSubscription = null;
          }

          // Use getUser() for secure server-side validation instead of getSession()
          const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();

          if (error) {
            console.error("[AuthStore] Error getting user:", error);
            set({ isLoading: false });
            return;
          }

          if (supabaseUser) {
            // Fetch user profile from our database
            await get().fetchUser();
            // Sync token from session for backward compatibility
            await get().syncTokenFromSession();
          } else {
            set({ isAuthenticated: false, user: null });
          }

          // Set up auth state change listener and store subscription for cleanup
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("[AuthStore] Auth state changed:", event);

            if (event === "SIGNED_OUT") {
              set({
                user: null,
                isAuthenticated: false,
                accessToken: null,
                refreshToken: null,
                tokenExpiresAt: null,
              });
            } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
              if (session?.user) {
                await get().fetchUser();
                // Sync token on refresh
                if (session.access_token) {
                  const expiresIn = session.expires_in || 3600;
                  set({
                    accessToken: session.access_token,
                    refreshToken: session.refresh_token || null,
                    tokenExpiresAt: Date.now() + expiresIn * 1000,
                  });
                }
              }
            }
          });

          // Store subscription for later cleanup
          authSubscription = subscription;
        } catch (error) {
          console.error("[AuthStore] Session initialization error:", error);
        }
      },

      syncTokenFromSession: async () => {
        try {
          const supabase = getSupabase();
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error || !session) {
            return;
          }

          const expiresIn = session.expires_in || 3600;
          set({
            accessToken: session.access_token,
            refreshToken: session.refresh_token || null,
            tokenExpiresAt: Date.now() + expiresIn * 1000,
          });
        } catch (error) {
          console.error("[AuthStore] syncTokenFromSession error:", error);
        }
      },

      // Legacy methods - kept for backward compatibility (silent, no console spam)
      startSessionMonitor: () => {
        // No-op: Sessions are managed via Supabase cookies
      },

      stopSessionMonitor: () => {
        // No-op: Sessions are managed via Supabase cookies
      },

      setTokens: (accessToken: string, refreshToken: string, expiresIn?: number) => {
        // Update in-memory tokens for backward compatibility
        const tokenExpiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;
        set({ accessToken, refreshToken, tokenExpiresAt });
      },

      refreshSession: async () => {
        // Refresh session and sync token
        try {
          const supabase = getSupabase();
          const { data: { session }, error } = await supabase.auth.refreshSession();
          if (!error && session) {
            const expiresIn = session.expires_in || 3600;
            set({
              accessToken: session.access_token,
              refreshToken: session.refresh_token || null,
              tokenExpiresAt: Date.now() + expiresIn * 1000,
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      checkSessionOnVisibility: async () => {
        // Sync token if needed when page becomes visible
        await get().syncTokenFromSession();
      },
    }),
    {
      name: "hydra-auth-storage",
      // Only persist user profile, not tokens (tokens are in cookies)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        return (hydratedState, error: unknown) => {
          console.log("[AuthStore] Rehydration complete:", {
            isAuthenticated: hydratedState?.isAuthenticated,
            hasUser: !!hydratedState?.user,
            error: error instanceof Error ? error.message : error,
          });
          if (error) {
            console.error("[AuthStore] Rehydration error:", error);
          }
          if (hydratedState?.setHasHydrated) {
            hydratedState.setHasHydrated(true);
          }
        };
      },
    }
  )
);
