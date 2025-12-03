"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { type Language, getTranslation } from "@/lib/i18n/landing";

interface CTASectionProps {
  lang: Language;
}

export function CTASection({ lang }: CTASectionProps) {
  const t = getTranslation(lang);

  return (
    <section id="cta" className="bg-black text-white py-24 lg:py-32 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Gradient Blurs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-zinc-800 rounded-full filter blur-3xl opacity-50" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-zinc-800 rounded-full filter blur-3xl opacity-50" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-6"
        >
          {t.cta.title}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg sm:text-xl text-zinc-400 mb-12 max-w-2xl mx-auto"
        >
          {t.cta.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
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

      </div>
    </section>
  );
}
