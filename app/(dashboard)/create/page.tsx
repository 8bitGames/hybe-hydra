"use client";

import { SessionDashboard } from "@/components/features/create/SessionDashboard";

/**
 * Video Create Entry Point
 *
 * Shows the Session Dashboard where users can:
 * - View and resume in-progress sessions
 * - View paused and completed sessions
 * - Create new video creation sessions
 *
 * This replaces the previous direct-to-create-stage flow.
 * All video creation now goes through the session management system.
 */
export default function CreatePage() {
  return <SessionDashboard />;
}
