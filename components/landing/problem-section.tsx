"use client";

import { motion } from "framer-motion";
import {
  TrendUp,
  Repeat,
  ShieldCheck,
  DeviceMobile
} from "@phosphor-icons/react";
import { type Language, getTranslation } from "@/lib/i18n/landing";

interface ProblemSectionProps {
  lang: Language;
}

const icons = [TrendUp, Repeat, ShieldCheck, DeviceMobile];

export function ProblemSection({ lang }: ProblemSectionProps) {
  const t = getTranslation(lang);

  return (
    <section className="bg-white py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Headlines */}
        <div className="text-center max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 leading-tight"
          >
            {t.problem.headline1}
          </motion.h2>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-400 leading-tight mt-2"
          >
            {t.problem.headline2}
          </motion.h2>
        </div>

        {/* Pain Points Grid */}
        <div className="mt-16 lg:mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {t.problem.painPoints.map((point, index) => {
            const Icon = icons[index];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group p-6 lg:p-8 bg-zinc-50 rounded-2xl hover:bg-zinc-100 transition-colors"
              >
                <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Icon size={24} className="text-white" weight="bold" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  {point.title}
                </h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  {point.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
