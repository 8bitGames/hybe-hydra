"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  type Persister,
  type PersistedClient as TanstackPersistedClient,
} from "@tanstack/react-query-persist-client";
import { useState, useEffect } from "react";
import { get, set, del } from "idb-keyval";

// Custom IndexedDB persister for large data (videos, etc.)
// Better than localStorage which has 5MB limit
const CACHE_KEY = "hydra-query-cache";
const CACHE_VERSION = 1;

interface CachedClient {
  timestamp: number;
  version: number;
  clientState: TanstackPersistedClient;
}

function createIDBPersister(): Persister {
  return {
    persistClient: async (client: TanstackPersistedClient) => {
      try {
        const cachedClient: CachedClient = {
          timestamp: Date.now(),
          version: CACHE_VERSION,
          clientState: client,
        };
        await set(CACHE_KEY, cachedClient);
      } catch (error) {
        console.warn("[QueryPersist] Failed to persist:", error);
      }
    },
    restoreClient: async (): Promise<TanstackPersistedClient | undefined> => {
      try {
        const cachedClient = await get<CachedClient>(CACHE_KEY);

        if (!cachedClient) {
          return undefined;
        }

        // Check version - invalidate if version changed
        if (cachedClient.version !== CACHE_VERSION) {
          console.log("[QueryPersist] Cache version mismatch, clearing");
          await del(CACHE_KEY);
          return undefined;
        }

        // Check max age (24 hours)
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - cachedClient.timestamp > maxAge) {
          console.log("[QueryPersist] Cache expired, clearing");
          await del(CACHE_KEY);
          return undefined;
        }

        console.log("[QueryPersist] Restored cache from", new Date(cachedClient.timestamp).toLocaleString());
        return cachedClient.clientState;
      } catch (error) {
        console.warn("[QueryPersist] Failed to restore:", error);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del(CACHE_KEY);
      } catch (error) {
        console.warn("[QueryPersist] Failed to remove:", error);
      }
    },
  };
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  // Create persister only on client
  const [persister] = useState(() => {
    if (typeof window === "undefined") return null;
    return createIDBPersister();
  });

  // Create QueryClient with optimized settings
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data considered fresh for 10 minutes
            staleTime: 10 * 60 * 1000,
            // Keep in memory cache for 1 hour
            gcTime: 60 * 60 * 1000,
            // Don't refetch on window focus
            refetchOnWindowFocus: false,
            // Don't refetch on mount if data exists and is fresh
            refetchOnMount: false,
            // Retry failed requests once
            retry: 1,
            // Network-first: use cache but revalidate
            networkMode: "offlineFirst",
          },
        },
      })
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  // On server or while hydrating, use non-persisted provider
  if (!isClient || !persister) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  // On client, use persisted provider
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // Only persist successful queries
            if (query.state.status !== "success") return false;

            // Don't persist queries with errors
            if (query.state.error) return false;

            // Persist video-related queries (they're expensive to fetch)
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey)) {
              const key = queryKey[0];
              // Persist these query types
              if (
                key === "fast-cut" ||
                key === "all-videos" ||
                key === "campaigns" ||
                key === "assets" ||
                key === "dashboard"
              ) {
                return true;
              }
            }

            // Persist by default for other queries
            return true;
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

// Export function to manually clear cache
export async function clearQueryCache() {
  try {
    await del(CACHE_KEY);
    console.log("[QueryPersist] Cache cleared manually");
  } catch (error) {
    console.warn("[QueryPersist] Failed to clear cache:", error);
  }
}
