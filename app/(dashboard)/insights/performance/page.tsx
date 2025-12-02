"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

/**
 * Insights Performance page - Redirects to /trends/performance
 * Performance analytics moved to Trends section
 */
export default function InsightsPerformancePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/trends/performance");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Spinner className="h-12 w-12 mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Performance...</p>
      </div>
    </div>
  );
}
