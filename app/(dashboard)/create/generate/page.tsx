"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

/**
 * Create Generate page - Redirects to /create?mode=generate
 * The generate functionality is now part of the unified Create page
 */
export default function CreateGeneratePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/create?mode=generate");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Spinner className="h-12 w-12 mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Create...</p>
      </div>
    </div>
  );
}
