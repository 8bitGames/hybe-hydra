"use client";

import { motion } from "framer-motion";
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

  return (
    <section className="bg-zinc-50 py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-block px-3 py-1 bg-zinc-200 text-zinc-600 text-xs font-medium rounded-full mb-4"
          >
            {t.capabilities.label}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900"
          >
            {t.capabilities.title}
          </motion.h2>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {t.capabilities.items.map((item, index) => {
            const Icon = capabilityIcons[index];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.4,
                  delay: (index % 4) * 0.05 + Math.floor(index / 4) * 0.1
                }}
                className="group p-6 bg-white rounded-xl hover:bg-zinc-900 transition-all duration-300 border border-zinc-100 hover:border-zinc-900"
              >
                <div className="w-10 h-10 bg-zinc-100 group-hover:bg-zinc-800 rounded-lg flex items-center justify-center mb-4 transition-colors duration-300">
                  <Icon
                    size={20}
                    className="text-zinc-900 group-hover:text-white transition-colors duration-300"
                    weight="bold"
                  />
                </div>
                <h4 className="font-semibold text-zinc-900 group-hover:text-white mb-1 transition-colors duration-300">
                  {item.title}
                </h4>
                <p className="text-sm text-zinc-500 group-hover:text-zinc-400 transition-colors duration-300">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
