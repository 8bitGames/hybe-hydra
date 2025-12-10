"use client";

import { FastCutProvider } from "@/lib/stores/fast-cut-context";

export default function FastCutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FastCutProvider>{children}</FastCutProvider>;
}
