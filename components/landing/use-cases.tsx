"use client";

import { motion } from "framer-motion";
import {
  MusicNotes,
  ShoppingBag,
  Buildings
} from "@phosphor-icons/react";
import { type Language, getTranslation } from "@/lib/i18n/landing";

interface UseCasesSectionProps {
  lang: Language;
}

const caseIcons = [MusicNotes, ShoppingBag, Buildings];

export function UseCasesSection({ lang }: UseCasesSectionProps) {
  const t = getTranslation(lang);

  return (
    <section id="use-cases" className="bg-white py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-block px-3 py-1 bg-zinc-100 text-zinc-600 text-xs font-medium rounded-full mb-4"
          >
            {t.useCases.label}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900"
          >
            {t.useCases.title}
          </motion.h2>
        </div>

        {/* Use Case Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {t.useCases.cases.map((useCase, index) => {
            const Icon = caseIcons[index];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative p-8 bg-zinc-50 rounded-2xl hover:bg-zinc-900 transition-all duration-500 cursor-default"
              >
                {/* Icon */}
                <div className="w-14 h-14 bg-zinc-900 group-hover:bg-white rounded-xl flex items-center justify-center mb-6 transition-colors duration-500">
                  <Icon
                    size={28}
                    className="text-white group-hover:text-zinc-900 transition-colors duration-500"
                    weight="bold"
                  />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-zinc-900 group-hover:text-white mb-2 transition-colors duration-500">
                  {useCase.title}
                </h3>

                {/* Tagline */}
                <p className="text-zinc-500 group-hover:text-zinc-400 text-sm mb-4 transition-colors duration-500">
                  {useCase.tagline}
                </p>

                {/* Description */}
                <p className="text-zinc-600 group-hover:text-zinc-300 text-sm leading-relaxed transition-colors duration-500">
                  {useCase.description}
                </p>

                {/* Decorative corner */}
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-zinc-200 group-hover:border-zinc-700 rounded-tr-lg opacity-50 transition-colors duration-500" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
