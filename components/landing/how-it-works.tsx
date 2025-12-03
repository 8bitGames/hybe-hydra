"use client";

import { motion } from "framer-motion";
import {
  MagnifyingGlass,
  Sparkle,
  CheckSquare,
  PaperPlaneTilt
} from "@phosphor-icons/react";
import { type Language, getTranslation } from "@/lib/i18n/landing";

interface HowItWorksSectionProps {
  lang: Language;
}

const stepIcons = [MagnifyingGlass, Sparkle, CheckSquare, PaperPlaneTilt];

export function HowItWorksSection({ lang }: HowItWorksSectionProps) {
  const t = getTranslation(lang);

  return (
    <section id="how-it-works" className="bg-black text-white py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-24">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-block px-3 py-1 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-full mb-4"
          >
            {t.howItWorks.label}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold"
          >
            {t.howItWorks.title}
          </motion.h2>
        </div>

        {/* Timeline - Desktop */}
        <div className="hidden lg:block relative">
          {/* Connection Line */}
          <div className="absolute top-16 left-0 right-0 h-px bg-zinc-800" />
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute top-16 left-0 right-0 h-px bg-gradient-to-r from-zinc-600 via-white to-zinc-600 origin-left"
          />

          {/* Steps */}
          <div className="grid grid-cols-4 gap-8">
            {t.howItWorks.steps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className="relative pt-8"
                >
                  {/* Number Circle */}
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.15 }}
                    className="absolute top-8 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-black border-2 border-white rounded-full flex items-center justify-center z-10"
                  >
                    <span className="text-xl font-bold">{step.number}</span>
                  </motion.div>

                  {/* Content */}
                  <div className="pt-16 text-center">
                    <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Icon size={24} className="text-white" weight="bold" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                    <p className="text-zinc-400 text-sm mb-3">{step.subtitle}</p>
                    <p className="text-zinc-500 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Timeline - Mobile */}
        <div className="lg:hidden space-y-8">
          {t.howItWorks.steps.map((step, index) => {
            const Icon = stepIcons[index];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="flex gap-6"
              >
                {/* Left - Number & Line */}
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-zinc-900 border-2 border-zinc-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold">{step.number}</span>
                  </div>
                  {index < t.howItWorks.steps.length - 1 && (
                    <div className="w-px h-full bg-zinc-800 mt-4" />
                  )}
                </div>

                {/* Right - Content */}
                <div className="pb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center">
                      <Icon size={20} className="text-white" weight="bold" />
                    </div>
                    <h3 className="text-lg font-bold">{step.title}</h3>
                  </div>
                  <p className="text-zinc-400 text-sm mb-2">{step.subtitle}</p>
                  <p className="text-zinc-500 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
