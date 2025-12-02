// Bridge Prompt Storage - Session Storage utility for passing prompt data between Bridge and Generate pages

import { PromptTransformResponse } from "./video-api";

const STORAGE_KEY = "hydra_bridge_prompt";

export interface BridgePromptData {
  campaignId: string;
  originalPrompt: string;
  transformedPrompt: PromptTransformResponse;
  selectedTrends: string[];
  timestamp: number;
}

// Save transformed prompt to session storage
export function saveBridgePrompt(data: BridgePromptData): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save bridge prompt:", error);
  }
}

// Load transformed prompt from session storage
export function loadBridgePrompt(campaignId: string): BridgePromptData | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored) as BridgePromptData;

    // Check if data is for the correct campaign
    if (data.campaignId !== campaignId) return null;

    // Check if data is not too old (30 minutes expiry)
    const EXPIRY_MS = 30 * 60 * 1000;
    if (Date.now() - data.timestamp > EXPIRY_MS) {
      clearBridgePrompt();
      return null;
    }

    return data;
  } catch (error) {
    console.error("Failed to load bridge prompt:", error);
    return null;
  }
}

// Clear stored prompt after use
export function clearBridgePrompt(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear bridge prompt:", error);
  }
}

// Check if there's a stored prompt for a campaign
export function hasBridgePrompt(campaignId: string): boolean {
  const data = loadBridgePrompt(campaignId);
  return data !== null;
}
