"use client";

import { motion } from "motion/react";
import {
  MagnifyingGlass,
  Sparkle,
  CheckSquare,
  PaperPlaneTilt
} from "@phosphor-icons/react";
import { type Language, getTranslation } from "@/lib/i18n/landing";
import { TracingBeam } from "@/components/ui/tracing-beam";

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
            className="inline-block px-4 py-1.5 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-full mb-4"
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

        {/* Desktop Timeline with TracingBeam */}
        <div className="hidden lg:block">
          <TracingBeam className="px-6">
            <div className="max-w-4xl mx-auto space-y-24">
              {t.howItWorks.steps.map((step, index) => {
                const Icon = stepIcons[index];
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="relative"
                  >
                    <div className="flex items-start gap-8">
                      {/* Number */}
                      <div className="flex-shrink-0 w-20 h-20 bg-zinc-900 border-2 border-zinc-700 rounded-2xl flex items-center justify-center">
                        <span className="text-2xl font-bold text-white">{step.number}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-2">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                            <Icon size={24} className="text-black" weight="bold" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-white">{step.title}</h3>
                            <p className="text-zinc-400">{step.subtitle}</p>
                          </div>
                        </div>
                        <p className="text-zinc-500 text-lg leading-relaxed pl-16">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </TracingBeam>
        </div>

        {/* Mobile Timeline */}
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
                  <div className="w-14 h-14 bg-zinc-900 border-2 border-zinc-700 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-white">{step.number}</span>
                  </div>
                  {index < t.howItWorks.steps.length - 1 && (
                    <div className="w-0.5 h-full bg-gradient-to-b from-zinc-700 to-transparent mt-4" />
                  )}
                </div>

                {/* Right - Content */}
                <div className="pb-8 flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                      <Icon size={20} className="text-black" weight="bold" />
                    </div>
                    <h3 className="text-lg font-bold text-white">{step.title}</h3>
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
