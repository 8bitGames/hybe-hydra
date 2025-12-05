"use client";

import { useState, useEffect, useCallback } from "react";
import { type Language } from "@/lib/i18n/landing";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { PoweredBySection } from "@/components/landing/powered-by-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { UseCasesSection } from "@/components/landing/use-cases";
import { CapabilitiesGrid } from "@/components/landing/capabilities-grid";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

// Storage key shared with I18nProvider
const LANGUAGE_STORAGE_KEY = "hydra-language";

export default function Home() {
  const [lang, setLangState] = useState<Language>("ko");

  // Sync with localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "ko" || stored === "en") {
      setLangState(stored);
    }
  }, []);

  // Wrapper to save to localStorage when language changes
  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
  }, []);

  return (
    <main className="min-h-screen bg-black">
      <Navigation lang={lang} onLanguageChange={setLang} />
      <HeroSection lang={lang} />
      <ProblemSection lang={lang} />
      <PoweredBySection />
      <FeaturesSection lang={lang} />
      <HowItWorksSection lang={lang} />
      <UseCasesSection lang={lang} />
      <CapabilitiesGrid lang={lang} />
      <CTASection lang={lang} />
      <Footer lang={lang} onLanguageChange={setLang} />
    </main>
  );
}
