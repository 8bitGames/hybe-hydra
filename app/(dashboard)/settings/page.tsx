"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect to accounts page by default
export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/accounts");
  }, [router]);

  return null;
}
