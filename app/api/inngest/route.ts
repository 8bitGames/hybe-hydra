/**
 * Inngest API Route - Webhook Handler
 * Inngest API 라우트 - 웹훅 핸들러
 *
 * This route handles Inngest webhook events for background job processing.
 *
 * Local Development:
 * - Run: npx inngest-cli@latest dev
 * - Dashboard: http://localhost:8288
 *
 * Production:
 * - Set INNGEST_SIGNING_KEY in environment variables
 * - Inngest will auto-discover this endpoint
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
