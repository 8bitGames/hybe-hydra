// Use relative URL for same-origin API routes (Next.js API Routes)
const API_BASE_URL = "";

interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Always get fresh token from localStorage (handles SSR -> client transition)
  private getTokenFromStorage(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("access_token");
    }
    return null;
  }

  private getRefreshTokenFromStorage(): string | null {
    if (typeof window !== "undefined") {
      try {
        const authData = localStorage.getItem("hydra-auth-storage");
        if (authData) {
          const parsed = JSON.parse(authData);
          return parsed.state?.refreshToken || null;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("access_token", token);
      } else {
        localStorage.removeItem("access_token");
      }
    }
  }

  getAccessToken(): string | null {
    // Check localStorage on every call to handle SSR -> client transition
    return this.accessToken || this.getTokenFromStorage();
  }

  // Refresh token and update storage
  private async refreshAccessToken(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const refreshToken = this.getRefreshTokenFromStorage();
        if (!refreshToken) {
          console.warn("[API] No refresh token available");
          return false;
        }

        const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
          console.warn("[API] Token refresh failed:", response.status);
          return false;
        }

        const data = await response.json();
        if (data.access_token) {
          this.setAccessToken(data.access_token);

          // Update zustand store in localStorage
          if (typeof window !== "undefined") {
            try {
              const authData = localStorage.getItem("hydra-auth-storage");
              if (authData) {
                const parsed = JSON.parse(authData);
                parsed.state.accessToken = data.access_token;
                if (data.refresh_token) {
                  parsed.state.refreshToken = data.refresh_token;
                }
                localStorage.setItem("hydra-auth-storage", JSON.stringify(parsed));
              }
            } catch (e) {
              console.warn("[API] Failed to update auth storage:", e);
            }
          }

          console.log("[API] Token refreshed successfully");
          return true;
        }
        return false;
      } catch (error) {
        console.error("[API] Token refresh error:", error);
        return false;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Get token fresh from storage or memory
    const token = this.getAccessToken();
    if (token) {
      (headers as Record<string, string>)["Authorization"] =
        `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized - try to refresh token and retry
      if (response.status === 401 && !isRetry && !endpoint.includes("/auth/")) {
        console.log("[API] 401 received, attempting token refresh...");
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the original request with new token
          return this.request<T>(endpoint, options, true);
        } else {
          // Refresh failed - trigger logout by dispatching event
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("auth:logout"));
          }
        }
      }

      // Handle 204 No Content (e.g., successful DELETE)
      if (response.status === 204) {
        return { data: null as T };
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          error: {
            code: response.status.toString(),
            message: data.detail || "An error occurred",
            details: data,
          },
        };
      }

      return { data };
    } catch (error) {
      return {
        error: {
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Network error",
        },
      };
    }
  }

  // GET request
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  // POST request
  async post<T, B = Record<string, unknown>>(
    endpoint: string,
    body?: B
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // PATCH request
  async patch<T>(
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const api = new ApiClient(API_BASE_URL);

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post<{ id: string; email: string; name: string; role: string }>(
      "/api/v1/auth/register",
      data
    ),

  login: (data: { email: string; password: string }) =>
    api.post<{ access_token: string; refresh_token: string; token_type: string }>(
      "/api/v1/auth/login",
      data
    ),

  refresh: (refreshToken: string) =>
    api.post<{ access_token: string; refresh_token: string; token_type: string }>(
      "/api/v1/auth/refresh",
      { refresh_token: refreshToken }
    ),

  logout: () => api.post("/api/v1/auth/logout"),
};

// Users API
export const usersApi = {
  getMe: () =>
    api.get<{
      id: string;
      email: string;
      name: string;
      role: string;
      label_ids: string[];
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>("/api/v1/users/me"),

  updateMe: (data: { name?: string }) =>
    api.patch<{ id: string; email: string; name: string; role: string }>(
      "/api/v1/users/me",
      data
    ),
};
