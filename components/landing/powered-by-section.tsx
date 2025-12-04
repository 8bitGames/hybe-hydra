"use client";

import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

const partners = [
  {
    name: "NVIDIA H200",
    logo: "/logos/nvidia.svg",
    subtitle: "GPU 가속",
  },
  {
    name: "OpenAI",
    logo: "/logos/openai.svg",
    subtitle: null,
  },
  {
    name: "Google Gemini",
    logo: "/logos/gemini.svg",
    subtitle: null,
  },
];

export function PoweredBySection() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className="relative bg-black py-24 lg:py-32 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-black to-black" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '64px 64px'
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="inline-block px-4 py-1.5 bg-zinc-900 text-zinc-400 text-xs font-medium rounded-full border border-zinc-800 mb-8">
            최첨단 기술로 구동
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
            <span className="text-white">Hydra</span>
            <span className="text-zinc-600">는 </span>
            <span className="bg-gradient-to-r from-[#76B900] to-[#9BE400] bg-clip-text text-transparent">
              NVIDIA H200
            </span>
            <span className="text-zinc-600">으로</span>
            <br />
            <span className="text-zinc-600">구동됩니다</span>
          </h2>
          <p className="mt-6 text-zinc-500 text-lg max-w-2xl mx-auto leading-relaxed">
            세계 최고 수준의 AI 인프라와 함께 가장 빠르고 정확한 영상 생성을 경험하세요
          </p>
        </motion.div>

        {/* Partner Cards with Hover Effect */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {partners.map((partner, index) => (
            <motion.div
              key={partner.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative group block p-2 h-full w-full"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <AnimatePresence>
                {hoveredIndex === index && (
                  <motion.span
                    className="absolute inset-0 h-full w-full bg-zinc-800/50 block rounded-2xl"
                    layoutId="poweredByHover"
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
                  "relative z-20 h-full w-full p-8 lg:p-10",
                  "bg-zinc-900/60 backdrop-blur-sm rounded-2xl",
                  "border border-zinc-800/80",
                  "hover:border-zinc-700/80 transition-all duration-300",
                  "flex flex-col items-center justify-center gap-6"
                )}
              >
                {/* Logo */}
                <div className="relative h-16 w-full flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                  <Image
                    src={partner.logo}
                    alt={partner.name}
                    width={160}
                    height={64}
                    className="object-contain max-h-16"
                  />
                </div>

                {/* Text */}
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {partner.name}
                  </h3>
                  <p className="text-sm text-zinc-500">
                    {partner.subtitle}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center text-zinc-600 text-sm mt-16"
        >
          엔터프라이즈급 인프라로 안정적이고 빠른 서비스를 제공합니다
        </motion.p>
      </div>
    </section>
  );
}
