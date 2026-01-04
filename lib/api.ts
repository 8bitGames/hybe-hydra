/**
 * Simplified API Client using cookie-based authentication
 *
 * This client:
 * - Uses `credentials: 'include'` for cookie-based auth (Supabase SSR)
 * - No localStorage token management
 * - On 401, dispatches logout event (Supabase handles token refresh via cookies)
 */

const API_BASE_URL = "";

interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    status?: number;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * @deprecated Use cookie-based auth. This method is kept for backward compatibility.
   */
  setAccessToken(_token: string | null) {
    // No-op: cookies are used for auth now
    console.warn("[API] setAccessToken is deprecated. Using cookie-based auth.");
  }

  /**
   * @deprecated Use cookie-based auth. This method is kept for backward compatibility.
   */
  getAccessToken(): string | null {
    // Return null - cookies are used for auth now
    return null;
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

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include", // Always include cookies for auth
      });

      // Handle 401 Unauthorized
      if (response.status === 401 && !isRetry && !endpoint.includes("/auth/")) {
        console.log("[API] 401 received, session may have expired");

        // Dispatch logout event - let the app handle the redirect
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("auth:logout"));
        }

        return {
          error: {
            code: "401",
            message: "Session expired. Please log in again.",
            status: 401,
          },
        };
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
            status: response.status,
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
  async post<T>(endpoint: string, body?: object): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // PUT request
  async put<T>(endpoint: string, body?: object): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // PATCH request
  async patch<T>(endpoint: string, body?: object): Promise<ApiResponse<T>> {
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
    api.post<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in?: number;
      user?: {
        id: string;
        email: string;
        name: string;
        role: string;
        label_ids: string[];
      };
    }>("/api/v1/auth/login", data),

  refresh: (refreshToken: string) =>
    api.post<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in?: number;
    }>("/api/v1/auth/refresh", { refresh_token: refreshToken }),

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
