"use client";

import { motion } from "motion/react";
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import {
  TrendUp,
  ArrowsClockwise,
  ShieldCheck,
  DeviceMobile
} from "@phosphor-icons/react";
import { type Language, getTranslation } from "@/lib/i18n/landing";
import { cn } from "@/lib/utils";

interface ProblemSectionProps {
  lang: Language;
}

const icons = [TrendUp, ArrowsClockwise, ShieldCheck, DeviceMobile];

export function ProblemSection({ lang }: ProblemSectionProps) {
  const t = getTranslation(lang);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const painPoints = t.problem.painPoints.map((point, index) => ({
    title: point.title,
    description: point.description,
    icon: icons[index],
  }));

  return (
    <section className="bg-black py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Headlines */}
        <div className="text-center max-w-4xl mx-auto mb-16 lg:mb-24">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight"
          >
            {t.problem.headline1}
          </motion.h2>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-500 leading-tight mt-2"
          >
            {t.problem.headline2}
          </motion.h2>
        </div>

        {/* Pain Points Grid with Hover Effect */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {painPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative group block p-2 h-full w-full"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <AnimatePresence>
                  {hoveredIndex === index && (
                    <motion.span
                      className="absolute inset-0 h-full w-full bg-zinc-800/50 block rounded-2xl"
                      layoutId="hoverBackground"
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: 1,
                        transition: { duration: 0.15 },
                      }}
                      exit={{
                        opacity: 0,
                        transition: { duration: 0.15, delay: 0.2 },
                      }}
                    />
                  )}
                </AnimatePresence>

                <div
                  className={cn(
                    "relative z-20 h-full w-full p-6 lg:p-8",
                    "bg-zinc-900/50 rounded-2xl border border-zinc-800",
                    "hover:border-zinc-700 transition-colors"
                  )}
                >
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Icon size={24} className="text-black" weight="bold" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {point.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {point.description}
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
