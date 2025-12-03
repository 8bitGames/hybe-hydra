"use client";

import { motion } from "motion/react";
import Image from "next/image";
import {
  MagnifyingGlass,
  Fingerprint,
  Stack,
  RocketLaunch,
  Globe,
  ChartLineUp,
  Check
} from "@phosphor-icons/react";
import { type Language, getTranslation } from "@/lib/i18n/landing";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { cn } from "@/lib/utils";

interface FeaturesSectionProps {
  lang: Language;
}

const featureConfig = [
  {
    key: "trendIntelligence" as const,
    icon: MagnifyingGlass,
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    className: "md:col-span-2",
  },
  {
    key: "brandIP" as const,
    icon: Fingerprint,
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80",
    className: "md:col-span-1",
  },
  {
    key: "massGeneration" as const,
    icon: Stack,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    className: "md:col-span-1",
  },
  {
    key: "oneClickPublish" as const,
    icon: RocketLaunch,
    image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80",
    className: "md:col-span-2",
  },
  {
    key: "hyperpersonalization" as const,
    icon: Globe,
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
    className: "md:col-span-1",
  },
  {
    key: "aeoGeo" as const,
    icon: ChartLineUp,
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    className: "md:col-span-2",
  },
];

function FeatureHeader({ image, label }: { image: string; label: string }) {
  return (
    <div className="relative w-full h-32 rounded-xl overflow-hidden bg-zinc-800">
      <Image
        src={image}
        alt={label}
        fill
        unoptimized
        className="object-cover grayscale group-hover/bento:grayscale-0 transition-all duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
    </div>
  );
}

export function FeaturesSection({ lang }: FeaturesSectionProps) {
  const t = getTranslation(lang);

  return (
    <section id="features" className="bg-black py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-full mb-4">
            {lang === "ko" ? "핵심 기능" : "Core Features"}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
            {lang === "ko" ? "AI 기반 엔터프라이즈 솔루션" : "AI-Powered Enterprise Solution"}
          </h2>
        </motion.div>

        {/* Bento Grid */}
        <BentoGrid className="md:auto-rows-[20rem] gap-4">
          {featureConfig.map((feature) => {
            const Icon = feature.icon;
            const featureData = t.features[feature.key];

            return (
              <BentoGridItem
                key={feature.key}
                title={
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">{featureData.title}</span>
                  </div>
                }
                description={
                  <div className="space-y-3">
                    <p className="text-zinc-400 text-sm">{featureData.subtitle}</p>
                    <ul className="space-y-1.5">
                      {featureData.bullets.slice(0, 2).map((bullet, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-500">
                          <Check size={12} className="text-white mt-0.5 flex-shrink-0" weight="bold" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                }
                header={<FeatureHeader image={feature.image} label={featureData.label} />}
                icon={
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-[#F7F91D] rounded-lg flex items-center justify-center">
                      <Icon size={16} className="text-black" weight="bold" />
                    </div>
                    <span className="text-xs text-zinc-500 font-medium">{featureData.label}</span>
                  </div>
                }
                className={cn(
                  feature.className,
                  "bg-zinc-900 border-zinc-800 hover:border-zinc-700",
                  "group/bento"
                )}
              />
            );
          })}
        </BentoGrid>
      </div>
    </section>
  );
}
