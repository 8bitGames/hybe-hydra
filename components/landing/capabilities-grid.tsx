"use client";

import { motion } from "motion/react";
import {
  Sparkle,
  MapPin,
  Palette,
  Share,
  Hash,
  GlobeHemisphereWest,
  ChartLine,
  Users,
  ShieldCheck,
  Rocket,
  Translate,
  Plugs
} from "@phosphor-icons/react";
import { type Language, getTranslation } from "@/lib/i18n/landing";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";

interface CapabilitiesGridProps {
  lang: Language;
}

const capabilityIcons = [
  Sparkle,
  MapPin,
  Palette,
  Share,
  Hash,
  GlobeHemisphereWest,
  ChartLine,
  Users,
  ShieldCheck,
  Rocket,
  Translate,
  Plugs
];

export function CapabilitiesGrid({ lang }: CapabilitiesGridProps) {
  const t = getTranslation(lang);

  // Transform capabilities for InfiniteMovingCards format
  const capabilities = t.capabilities.items.map((item, index) => ({
    quote: item.description,
    name: item.title,
    title: "", // Not used but required by component
    icon: capabilityIcons[index],
  }));

  // Split into two rows
  const firstRow = capabilities.slice(0, 6);
  const secondRow = capabilities.slice(6, 12);

  return (
    <section className="bg-black py-24 lg:py-32 overflow-hidden">
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
            {t.capabilities.label}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white"
          >
            {t.capabilities.title}
          </motion.h2>
        </div>
      </div>

      {/* Infinite Moving Cards */}
      <div className="space-y-6">
        {/* First Row - Left to Right */}
        <div className="relative">
          <InfiniteMovingCards
            items={firstRow.map((cap) => ({
              quote: cap.quote,
              name: cap.name,
              title: "",
            }))}
            direction="left"
            speed="slow"
            pauseOnHover={true}
            className="py-2"
          />
        </div>

        {/* Second Row - Right to Left */}
        <div className="relative">
          <InfiniteMovingCards
            items={secondRow.map((cap) => ({
              quote: cap.quote,
              name: cap.name,
              title: "",
            }))}
            direction="right"
            speed="slow"
            pauseOnHover={true}
            className="py-2"
          />
        </div>
      </div>

      {/* Static Grid for Mobile */}
      <div className="lg:hidden max-w-7xl mx-auto px-4 sm:px-6 mt-12">
        <div className="grid grid-cols-2 gap-4">
          {capabilities.slice(0, 8).map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="p-4 bg-zinc-900 rounded-xl border border-zinc-800"
              >
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center mb-3">
                  <Icon size={20} className="text-white" weight="bold" />
                </div>
                <h4 className="font-semibold text-white text-sm mb-1">
                  {item.name}
                </h4>
                <p className="text-xs text-zinc-500 line-clamp-2">
                  {item.quote}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
