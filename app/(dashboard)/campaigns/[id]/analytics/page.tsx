"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Analytics page - Redirects to campaign root
 * Analytics is now the default view at /campaigns/[id]
 */
export default function CampaignAnalyticsRedirect() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  useEffect(() => {
    // Redirect to campaign root (analytics is now the default view)
    router.replace(`/campaigns/${campaignId}`);
  }, [campaignId, router]);

  return null;
}
