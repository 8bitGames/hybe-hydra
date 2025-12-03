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
import { Spotlight } from "@/components/ui/spotlight";

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

        {/* Hydra Concept - Hero Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-20 lg:mt-32 relative"
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-black to-zinc-900 border border-zinc-800 p-8 lg:p-12">
            {/* Spotlight Effect */}
            <Spotlight
              className="-top-40 left-0 md:left-60 md:-top-20"
              fill="#F7F91D"
            />

            {/* Animated glow behind HYDRA */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#F7F91D]/10 rounded-full blur-[100px] animate-pulse" />

            <div className="relative z-10 text-center">
              {/* HYDRA Logo/Text */}
              <motion.h3
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="text-5xl lg:text-7xl font-black tracking-tight mb-6"
              >
                <span className="bg-gradient-to-r from-[#F7F91D] via-[#F7F91D] to-yellow-300 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(247,249,29,0.5)]">
                  HYDRA
                </span>
              </motion.h3>

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="text-lg lg:text-xl text-zinc-300 max-w-xl mx-auto [word-break:keep-all] leading-relaxed"
              >
                {lang === "ko"
                  ? "하나의 머리에서 셋이 자라나듯, 하나의 영상이 수천 개로"
                  : "Like one head becoming three, one video becomes thousands"}
              </motion.p>

              {/* Visual representation - 1 to many with continuous animation */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="mt-8 flex items-center justify-center gap-4"
              >
                {/* Source box with pulse */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-12 h-12 rounded-xl bg-[#F7F91D] flex items-center justify-center text-black font-bold text-lg shadow-[0_0_20px_rgba(247,249,29,0.4)]"
                >
                  1
                </motion.div>

                {/* Arrow with flowing dots */}
                <div className="flex items-center gap-1 relative w-12">
                  <div className="absolute inset-0 flex items-center">
                    <motion.div
                      animate={{ x: [0, 48, 0], opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="w-2 h-2 rounded-full bg-[#F7F91D]"
                    />
                  </div>
                  <div className="w-full h-0.5 bg-gradient-to-r from-[#F7F91D]/50 to-zinc-700" />
                </div>

                {/* Output boxes with wave animation */}
                <div className="flex gap-2">
                  {[1, 2, 3].map((num, i) => (
                    <motion.div
                      key={num}
                      animate={{ y: [0, -4, 0] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.2
                      }}
                      className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 text-sm font-medium"
                    >
                      {num}
                    </motion.div>
                  ))}
                  <motion.div
                    animate={{
                      y: [0, -4, 0],
                      borderColor: ["rgba(113,113,122,1)", "rgba(247,249,29,0.6)", "rgba(113,113,122,1)"]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.6
                    }}
                    className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-dashed border-zinc-600 flex items-center justify-center text-[#F7F91D] text-xs font-medium"
                  >
                    +∞
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
