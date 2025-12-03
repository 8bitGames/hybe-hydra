"use client";

import { motion } from "framer-motion";
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

interface FeaturesSectionProps {
  lang: Language;
}

const featureConfig = [
  {
    key: "trendIntelligence" as const,
    icon: MagnifyingGlass,
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    imageAlt: "Analytics dashboard showing trend data"
  },
  {
    key: "brandIP" as const,
    icon: Fingerprint,
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80",
    imageAlt: "Brand assets and product photography"
  },
  {
    key: "massGeneration" as const,
    icon: Stack,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    imageAlt: "Grid of video content variations"
  },
  {
    key: "oneClickPublish" as const,
    icon: RocketLaunch,
    image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80",
    imageAlt: "Social media platform icons"
  },
  {
    key: "hyperpersonalization" as const,
    icon: Globe,
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
    imageAlt: "Global network visualization"
  },
  {
    key: "aeoGeo" as const,
    icon: ChartLineUp,
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    imageAlt: "Growth analytics and viral metrics"
  },
];

export function FeaturesSection({ lang }: FeaturesSectionProps) {
  const t = getTranslation(lang);

  return (
    <section id="features" className="py-24 lg:py-32">
      {featureConfig.map((feature, index) => {
        const Icon = feature.icon;
        const featureData = t.features[feature.key];
        const isReversed = index % 2 === 1;

        return (
          <div
            key={feature.key}
            className={index % 2 === 0 ? "bg-white" : "bg-zinc-50"}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
              <div
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
                  isReversed ? "lg:flex-row-reverse" : ""
                }`}
              >
                {/* Content */}
                <motion.div
                  initial={{ opacity: 0, x: isReversed ? 30 : -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6 }}
                  className={isReversed ? "lg:order-2" : ""}
                >
                  {/* Label */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 text-white text-xs font-medium rounded-full mb-6">
                    <Icon size={14} weight="bold" />
                    {featureData.label}
                  </div>

                  {/* Title */}
                  <h3 className="text-3xl lg:text-4xl font-bold text-zinc-900 mb-4">
                    {featureData.title}
                  </h3>

                  {/* Subtitle */}
                  <p className="text-xl text-zinc-500 mb-6">
                    {featureData.subtitle}
                  </p>

                  {/* Description */}
                  <p className="text-zinc-600 leading-relaxed mb-8">
                    {featureData.description}
                  </p>

                  {/* Bullets */}
                  <ul className="space-y-3">
                    {featureData.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-5 h-5 bg-zinc-900 rounded-full flex items-center justify-center mt-0.5">
                          <Check size={12} className="text-white" weight="bold" />
                        </div>
                        <span className="text-zinc-700">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>

                {/* Image */}
                <motion.div
                  initial={{ opacity: 0, x: isReversed ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className={isReversed ? "lg:order-1" : ""}
                >
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-200">
                    <Image
                      src={feature.image}
                      alt={feature.imageAlt}
                      fill
                      unoptimized
                      className="object-cover grayscale hover:grayscale-0 transition-all duration-500"
                    />
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
