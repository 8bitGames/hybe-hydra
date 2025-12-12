/**
 * GCP Authentication Manager for Vertex AI
 * =========================================
 * Handles authentication with Google Cloud Platform for Vertex AI API calls.
 *
 * Supports:
 * - Service Account Key File (via GCP_SERVICE_ACCOUNT_KEY_FILE env var - recommended)
 * - Service Account JSON (via GOOGLE_SERVICE_ACCOUNT_JSON env var)
 * - Application Default Credentials (for local development with gcloud)
 * - Workload Identity Federation (for AWS environments)
 *
 * Authentication Flow:
 * Service Account JSON → OAuth2 Token → Vertex AI API
 */

import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

// Default configuration
const DEFAULT_GCP_LOCATION = 'us-central1';
const VERTEX_AI_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/aiplatform',
];

export interface GCPAuthConfig {
  projectId?: string;
  location?: string;
  serviceAccountJson?: string;
  serviceAccountKeyFile?: string;
}

export interface AuthValidationResult {
  valid: boolean;
  projectId: string;
  location: string;
  error?: string;
  tokenPreview?: string;
}

/**
 * GCP Authentication Manager
 *
 * Usage:
 *   const auth = new GCPAuthManager();
 *   const token = await auth.getAccessToken();
 *   const headers = await auth.getAuthHeaders();
 */
export class GCPAuthManager {
  private projectId: string;
  private location: string;
  private auth: GoogleAuth | null = null;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: GCPAuthConfig = {}) {
    this.projectId = config.projectId || process.env.GCP_PROJECT_ID || 'hyb-hydra-dev';
    this.location = config.location || process.env.GCP_LOCATION || DEFAULT_GCP_LOCATION;

    this.initializeAuth({
      serviceAccountJson: config.serviceAccountJson,
      serviceAccountKeyFile: config.serviceAccountKeyFile,
    });
  }

  /**
   * Initialize Google Auth client
   */
  private initializeAuth(config: { serviceAccountJson?: string; serviceAccountKeyFile?: string } = {}): void {
    // Priority: 1. Key File Path → 2. JSON String → 3. ADC
    const keyFilePath = config.serviceAccountKeyFile || process.env.GCP_SERVICE_ACCOUNT_KEY_FILE;
    const saJson = config.serviceAccountJson || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    // 1. Try service account key file first (recommended)
    if (keyFilePath) {
      try {
        const resolvedPath = path.resolve(keyFilePath);
        if (fs.existsSync(resolvedPath)) {
          const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
          const credentials = JSON.parse(fileContent);

          // Override projectId from credentials if not set
          if (!this.projectId || this.projectId === 'hyb-hydra-dev') {
            this.projectId = credentials.project_id || this.projectId;
          }

          this.auth = new GoogleAuth({
            credentials,
            scopes: VERTEX_AI_SCOPES,
            projectId: this.projectId,
          });
          console.log(`[GCPAuth] Initialized with service account key file: ${resolvedPath}`);
          console.log(`[GCPAuth] Project: ${this.projectId}, Service Account: ${credentials.client_email}`);
          return;
        } else {
          console.warn(`[GCPAuth] Key file not found: ${resolvedPath}`);
        }
      } catch (error) {
        console.error('[GCPAuth] Failed to load service account key file:', error);
      }
    }

    // 2. Try JSON string from environment variable
    if (saJson) {
      try {
        const credentials = JSON.parse(saJson);
        this.auth = new GoogleAuth({
          credentials,
          scopes: VERTEX_AI_SCOPES,
          projectId: this.projectId,
        });
        console.log('[GCPAuth] Initialized with service account JSON');
        return;
      } catch (error) {
        console.error('[GCPAuth] Failed to parse service account JSON:', error);
        throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format');
      }
    }

    // 3. Fall back to Application Default Credentials
    this.auth = new GoogleAuth({
      scopes: VERTEX_AI_SCOPES,
      projectId: this.projectId,
    });
    console.log('[GCPAuth] Initialized with Application Default Credentials');
  }

  /**
   * Get project ID
   */
  getProjectId(): string {
    return this.projectId;
  }

  /**
   * Get location
   */
  getLocation(): string {
    return this.location;
  }

  /**
   * Get a valid access token
   */
  async getAccessToken(forceRefresh: boolean = false): Promise<string> {
    // Check if cached token is still valid (with 5 minute buffer)
    const now = Date.now();
    if (!forceRefresh && this.cachedToken && this.tokenExpiry > now + 5 * 60 * 1000) {
      return this.cachedToken;
    }

    if (!this.auth) {
      throw new Error('GCP Auth not initialized');
    }

    try {
      const client = await this.auth.getClient();
      const tokenResponse = await client.getAccessToken();

      if (!tokenResponse.token) {
        throw new Error('Failed to obtain access token');
      }

      this.cachedToken = tokenResponse.token;
      // Set expiry to 55 minutes from now (tokens typically last 1 hour)
      this.tokenExpiry = now + 55 * 60 * 1000;

      console.log('[GCPAuth] Access token refreshed');
      return this.cachedToken;
    } catch (error) {
      console.error('[GCPAuth] Failed to get access token:', error);
      throw error;
    }
  }

  /**
   * Get authorization headers for HTTP requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get the Vertex AI API endpoint URL
   */
  getVertexAIEndpoint(apiPath: string = ''): string {
    const baseUrl = `https://${this.location}-aiplatform.googleapis.com/v1`;
    const projectPath = `projects/${this.projectId}/locations/${this.location}`;

    if (apiPath) {
      return `${baseUrl}/${projectPath}/${apiPath}`;
    }
    return `${baseUrl}/${projectPath}`;
  }

  /**
   * Validate authentication by attempting to get credentials
   */
  async validateAuth(): Promise<AuthValidationResult> {
    const result: AuthValidationResult = {
      valid: false,
      projectId: this.projectId,
      location: this.location,
    };

    try {
      const token = await this.getAccessToken();
      result.valid = true;
      result.tokenPreview = token ? `${token.substring(0, 20)}...` : undefined;
      console.log('[GCPAuth] Authentication validation successful');
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error('[GCPAuth] Authentication validation failed:', result.error);
    }

    return result;
  }
}

// Singleton instance
let authManagerInstance: GCPAuthManager | null = null;

/**
 * Get the singleton GCP Auth Manager instance
 */
export function getGCPAuthManager(config?: GCPAuthConfig): GCPAuthManager {
  if (!authManagerInstance) {
    authManagerInstance = new GCPAuthManager(config);
  }
  return authManagerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetGCPAuthManager(): void {
  authManagerInstance = null;
}

/**
 * Convenience function to get an access token
 */
export async function getAccessToken(): Promise<string> {
  return getGCPAuthManager().getAccessToken();
}

/**
 * Convenience function to get auth headers
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  return getGCPAuthManager().getAuthHeaders();
}
