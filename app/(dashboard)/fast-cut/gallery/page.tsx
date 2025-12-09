"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect to unified videos page
 * The /fast-cut/gallery page has been merged with /videos
 */
export default function FastCutGalleryRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/videos");
  }, [router]);

  return null;
}
