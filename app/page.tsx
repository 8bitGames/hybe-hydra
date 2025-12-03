"use client";

import { useState } from "react";
import { type Language } from "@/lib/i18n/landing";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { UseCasesSection } from "@/components/landing/use-cases";
import { CapabilitiesGrid } from "@/components/landing/capabilities-grid";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  const [lang, setLang] = useState<Language>("ko");

  return (
    <main className="min-h-screen bg-black">
      <Navigation lang={lang} onLanguageChange={setLang} />
      <HeroSection lang={lang} />
      <ProblemSection lang={lang} />
      <FeaturesSection lang={lang} />
      <HowItWorksSection lang={lang} />
      <UseCasesSection lang={lang} />
      <CapabilitiesGrid lang={lang} />
      <CTASection lang={lang} />
      <Footer lang={lang} onLanguageChange={setLang} />
    </main>
  );
}
