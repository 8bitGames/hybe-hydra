import { useState, useEffect } from "react";

interface PresignedUrlCache {
  [key: string]: {
    url: string;
    expiry: number;
  };
}

// In-memory cache for presigned URLs (30 minute cache)
const urlCache: PresignedUrlCache = {};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Hook to get a presigned URL for an S3 resource
 */
export function usePresignedUrl(s3Url: string | null | undefined): {
  presignedUrl: string | null;
  loading: boolean;
  error: string | null;
} {
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!s3Url) {
      setPresignedUrl(null);
      return;
    }

    // Check cache first
    const cached = urlCache[s3Url];
    if (cached && cached.expiry > Date.now()) {
      setPresignedUrl(cached.url);
      return;
    }

    const fetchPresignedUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/v1/assets/presign?url=${encodeURIComponent(s3Url)}`
        );

        if (!response.ok) {
          throw new Error("Failed to get presigned URL");
        }

        const data = await response.json();

        // Cache the result
        urlCache[s3Url] = {
          url: data.presignedUrl,
          expiry: Date.now() + CACHE_DURATION,
        };

        setPresignedUrl(data.presignedUrl);
      } catch (err) {
        console.error("Error fetching presigned URL:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        // Fallback to original URL (might work if bucket becomes public)
        setPresignedUrl(s3Url);
      } finally {
        setLoading(false);
      }
    };

    fetchPresignedUrl();
  }, [s3Url]);

  return { presignedUrl, loading, error };
}

/**
 * Utility function to get presigned URL (for non-hook use cases)
 */
export async function getPresignedUrlClient(
  s3Url: string
): Promise<string | null> {
  // Check cache first
  const cached = urlCache[s3Url];
  if (cached && cached.expiry > Date.now()) {
    return cached.url;
  }

  try {
    const response = await fetch(
      `/api/v1/assets/presign?url=${encodeURIComponent(s3Url)}`
    );

    if (!response.ok) {
      throw new Error("Failed to get presigned URL");
    }

    const data = await response.json();

    // Cache the result
    urlCache[s3Url] = {
      url: data.presignedUrl,
      expiry: Date.now() + CACHE_DURATION,
    };

    return data.presignedUrl;
  } catch (err) {
    console.error("Error fetching presigned URL:", err);
    return s3Url; // Fallback to original URL
  }
}
