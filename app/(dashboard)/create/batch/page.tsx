"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

/**
 * Batch Variations page - Redirects to /pipeline
 *
 * The batch variations functionality has been consolidated into the Pipeline page
 * which provides a better UX with:
 * - AI Videos tab: Create variations from AI-generated videos
 * - Compose tab: Create variations from composed slideshow videos
 * - Pipelines tab: Monitor all variation generation jobs
 */
export default function BatchVariationsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the unified Pipeline page
    router.replace("/pipeline");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center space-y-4">
        <Spinner className="w-8 h-8 mx-auto" />
        <p className="text-muted-foreground">Redirecting to Pipeline...</p>
      </div>
    </div>
  );
}
