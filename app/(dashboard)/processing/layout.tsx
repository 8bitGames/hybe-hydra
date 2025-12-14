"use client";

import { FastCutProvider } from "@/lib/stores/fast-cut-context";

export default function ProcessingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FastCutProvider>{children}</FastCutProvider>;
}
