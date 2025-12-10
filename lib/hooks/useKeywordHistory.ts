"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "fast-cut-keyword-history";
const MAX_HISTORY = 30;

export function useKeywordHistory() {
  const [history, setHistory] = useState<string[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save to localStorage whenever history changes
  const saveHistory = useCallback((newHistory: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Add a keyword to history (most recent first)
  const addToHistory = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim().toLowerCase();
      if (!trimmed) return;

      setHistory((prev) => {
        // Remove if already exists
        const filtered = prev.filter((k) => k.toLowerCase() !== trimmed);
        // Add to front, limit to MAX_HISTORY
        const newHistory = [trimmed, ...filtered].slice(0, MAX_HISTORY);
        saveHistory(newHistory);
        return newHistory;
      });
    },
    [saveHistory]
  );

  // Get suggestions based on input
  const getSuggestions = useCallback(
    (input: string, limit = 8): string[] => {
      const trimmed = input.trim().toLowerCase();
      if (!trimmed) {
        // Return recent history if no input
        return history.slice(0, limit);
      }
      // Filter by starts with or contains
      return history
        .filter((k) => k.toLowerCase().includes(trimmed))
        .sort((a, b) => {
          // Prioritize starts with
          const aStarts = a.toLowerCase().startsWith(trimmed);
          const bStarts = b.toLowerCase().startsWith(trimmed);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return 0;
        })
        .slice(0, limit);
    },
    [history]
  );

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return {
    history,
    addToHistory,
    getSuggestions,
    clearHistory,
  };
}
