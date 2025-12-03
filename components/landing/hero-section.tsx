"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { RetroGrid } from "@/components/ui/retro-grid";
import { Meteors } from "@/components/ui/meteors";
import { type Language, getTranslation } from "@/lib/i18n/landing";

interface HeroSectionProps {
  lang: Language;
}

export function HeroSection({ lang }: HeroSectionProps) {
  const t = getTranslation(lang);

  const scrollToFeatures = () => {
    const element = document.getElementById("features");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen bg-black text-white flex items-center justify-center overflow-hidden">
      {/* Retro Grid Background */}
      <RetroGrid
        angle={65}
        cellSize={50}
        opacity={0.7}
        lightLineColor="rgba(255,255,255,0.3)"
        darkLineColor="rgba(255,255,255,0.3)"
      />

      {/* Meteors */}
      <Meteors
        number={40}
        angle={215}
        minDuration={2}
        maxDuration={6}
        minDelay={0.2}
        maxDelay={1}
        className="bg-white"
      />

      {/* Top Gradient Overlay - softer to show more grid */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-transparent z-[1]" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        {/* Main Headlines */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h1 className="font-[var(--font-geist)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            {t.hero.headline1}
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h1 className="font-[var(--font-geist)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mt-2 text-zinc-400">
            {t.hero.headline2}
          </h1>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mt-8 text-lg sm:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed"
        >
          {t.hero.subheadline}
        </motion.p>

        {/* Register Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mt-12"
        >
          <Button
            asChild
            size="lg"
            className="bg-white text-black hover:bg-zinc-200 rounded-full px-10 py-6 text-base font-medium transition-all hover:scale-105 group"
          >
            <Link href="/register">
              {lang === "ko" ? "시작하기" : "Get Started"}
              <ArrowRight
                size={18}
                className="ml-2 group-hover:translate-x-1 transition-transform"
                weight="bold"
              />
            </Link>
          </Button>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          onClick={scrollToFeatures}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-zinc-500 hover:text-white transition-colors"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowDown size={24} />
          </motion.div>
        </motion.button>
      </div>
    </section>
  );
}
