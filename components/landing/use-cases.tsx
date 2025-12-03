"use client";

import { motion } from "motion/react";
import {
  MusicNotes,
  ShoppingBag,
  Buildings
} from "@phosphor-icons/react";
import { type Language, getTranslation } from "@/lib/i18n/landing";
import { GlareCard } from "@/components/ui/glare-card";

interface UseCasesSectionProps {
  lang: Language;
}

const caseIcons = [MusicNotes, ShoppingBag, Buildings];

export function UseCasesSection({ lang }: UseCasesSectionProps) {
  const t = getTranslation(lang);

  return (
    <section id="use-cases" className="bg-black py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-block px-4 py-1.5 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-full mb-4"
          >
            {t.useCases.label}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white"
          >
            {t.useCases.title}
          </motion.h2>
        </div>

        {/* Use Case Cards with GlareCard */}
        <div className="flex flex-wrap justify-center gap-8 lg:gap-12">
          {t.useCases.cases.map((useCase, index) => {
            const Icon = caseIcons[index];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
              >
                <GlareCard className="flex flex-col p-8 bg-zinc-900">
                  {/* Icon */}
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6">
                    <Icon size={32} className="text-black" weight="bold" />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {useCase.title}
                  </h3>

                  {/* Tagline */}
                  <p className="text-zinc-400 text-sm mb-4">
                    {useCase.tagline}
                  </p>

                  {/* Description */}
                  <p className="text-zinc-500 text-sm leading-relaxed flex-1">
                    {useCase.description}
                  </p>

                  {/* Decorative element */}
                  <div className="mt-6 pt-6 border-t border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-white rounded-full" />
                      <span className="text-xs text-zinc-500">
                        {lang === "ko" ? "도입 가능" : "Available"}
                      </span>
                    </div>
                  </div>
                </GlareCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
