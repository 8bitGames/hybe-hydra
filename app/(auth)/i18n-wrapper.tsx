"use client";

import { I18nProvider } from "@/lib/i18n";
import { ReactNode } from "react";

export function AuthI18nWrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
