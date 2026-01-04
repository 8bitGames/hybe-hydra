"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

/**
 * User profile from our Prisma database
 */
interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  label_ids: string[];
  is_active: boolean;
}

interface AuthState {
  user: UserProfile | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface UseAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

/**
 * Unified auth hook that uses ONLY Supabase cookies for authentication.
 *
 * This hook:
 * - Uses Supabase SSR client for cookie-based auth (no localStorage)
 * - Has a single onAuthStateChange listener
 * - Fetches user profile from our Prisma database
 * - Provides consistent auth state across the app
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    supabaseUser: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Refs to prevent duplicate calls
  const isInitialized = useRef(false);
  const isFetchingProfile = useRef(false);

  // Create Supabase client (memoized per component instance)
  const supabase = createClient();

  /**
   * Fetch user profile from our database
   */
  const fetchUserProfile = useCallback(async (email: string): Promise<UserProfile | null> => {
    if (isFetchingProfile.current) return null;
    isFetchingProfile.current = true;

    try {
      const response = await fetch("/api/v1/users/me", {
        credentials: "include", // Send cookies
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn("[useAuth] Failed to fetch user profile:", response.status);
        return null;
      }

      const data = await response.json();
      return data as UserProfile;
    } catch (error) {
      console.error("[useAuth] Error fetching user profile:", error);
      return null;
    } finally {
      isFetchingProfile.current = false;
    }
  }, []);

  /**
   * Login with email and password
   */
  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Use our backend API which sets cookies properly
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: data.detail || "Login failed" };
      }

      // Supabase session is now set via cookies by the API
      // Get the session to update local state
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        // Fallback: create session from API response
        console.log("[useAuth] Setting session from API response");
      }

      // Set user from API response (already includes user profile)
      if (data.user) {
        setState({
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            label_ids: data.user.label_ids || [],
            is_active: true,
          },
          supabaseUser: session?.user || null,
          session: session || null,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        // Fetch profile if not included
        const profile = await fetchUserProfile(email);
        setState({
          user: profile,
          supabaseUser: session?.user || null,
          session: session || null,
          isLoading: false,
          isAuthenticated: !!profile,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("[useAuth] Login error:", error);
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: "Network error" };
    }
  }, [supabase, fetchUserProfile]);

  /**
   * Register a new user
   */
  const register = useCallback(async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: data.detail || "Registration failed" };
      }

      setState(prev => ({ ...prev, isLoading: false }));

      // Auto-login after registration
      return login(email, password);
    } catch (error) {
      console.error("[useAuth] Registration error:", error);
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: "Network error" };
    }
  }, [login]);

  /**
   * Logout
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      // Sign out from Supabase (clears cookies)
      await supabase.auth.signOut();

      // Also call our backend to ensure clean logout
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch(() => {}); // Ignore errors

      setState({
        user: null,
        supabaseUser: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error("[useAuth] Logout error:", error);
      // Clear state anyway
      setState({
        user: null,
        supabaseUser: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, [supabase]);

  /**
   * Manually refresh the session
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error || !session) {
        console.warn("[useAuth] Session refresh failed:", error);
        return false;
      }

      // Update state with refreshed session
      setState(prev => ({
        ...prev,
        session,
        supabaseUser: session.user,
      }));

      return true;
    } catch (error) {
      console.error("[useAuth] Session refresh error:", error);
      return false;
    }
  }, [supabase]);

  /**
   * Initialize auth state and set up listener
   */
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const initializeAuth = async () => {
      try {
        // Get current session from cookies
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("[useAuth] Error getting session:", error);
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        if (session?.user) {
          // Fetch user profile from our database
          const profile = await fetchUserProfile(session.user.email || "");

          setState({
            user: profile,
            supabaseUser: session.user,
            session,
            isLoading: false,
            isAuthenticated: !!profile,
          });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error("[useAuth] Initialization error:", error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[useAuth] Auth state changed:", event);

        if (event === "SIGNED_OUT") {
          setState({
            user: null,
            supabaseUser: null,
            session: null,
            isLoading: false,
            isAuthenticated: false,
          });
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          if (session?.user) {
            const profile = await fetchUserProfile(session.user.email || "");
            setState({
              user: profile,
              supabaseUser: session.user,
              session,
              isLoading: false,
              isAuthenticated: !!profile,
            });
          }
        }
      }
    );

    // Cleanup
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserProfile]);

  return {
    ...state,
    login,
    register,
    logout,
    refreshSession,
  };
}

export type { UserProfile, AuthState, UseAuthReturn };
