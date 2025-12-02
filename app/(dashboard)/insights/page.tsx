"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

/**
 * Insights page - Redirects to /trends
 * The Insights functionality has been consolidated into the Trends page
 */
export default function InsightsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/trends");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Spinner className="h-12 w-12 mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Trends...</p>
      </div>
    </div>
  );
}
