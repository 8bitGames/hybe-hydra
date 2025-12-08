"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Info page - Redirects to campaign analytics
 * Campaign info is now displayed in the layout header
 */
export default function CampaignInfoPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  useEffect(() => {
    // Redirect to campaign root (analytics is now the default view)
    router.replace(`/campaigns/${campaignId}`);
  }, [campaignId, router]);

  return null;
}
