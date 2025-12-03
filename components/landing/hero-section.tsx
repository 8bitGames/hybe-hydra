"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { ArrowRight, Play, Lightning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { type Language } from "@/lib/i18n/landing";

// Dynamically import Globe to avoid SSR issues with Three.js
const World = dynamic(() => import("@/components/ui/globe").then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="w-20 h-20 border-4 border-white/10 border-t-white rounded-full animate-spin" />
    </div>
  ),
});

interface HeroSectionProps {
  lang: Language;
}

// Arc data - videos spreading from Korea to the world
const globeArcs = [
  // Korea (Seoul) to USA (New York)
  { order: 1, startLat: 37.5665, startLng: 126.9780, endLat: 40.7128, endLng: -74.0060, arcAlt: 0.35, color: "#F7F91D" },
  // Korea to USA (Los Angeles)
  { order: 2, startLat: 37.5665, startLng: 126.9780, endLat: 34.0522, endLng: -118.2437, arcAlt: 0.4, color: "#F7F91D" },
  // Korea to Japan (Tokyo)
  { order: 3, startLat: 37.5665, startLng: 126.9780, endLat: 35.6762, endLng: 139.6503, arcAlt: 0.1, color: "#F7F91D" },
  // Korea to UK (London)
  { order: 4, startLat: 37.5665, startLng: 126.9780, endLat: 51.5074, endLng: -0.1278, arcAlt: 0.45, color: "#F7F91D" },
  // Korea to Brazil (Sao Paulo)
  { order: 5, startLat: 37.5665, startLng: 126.9780, endLat: -23.5505, endLng: -46.6333, arcAlt: 0.5, color: "#F7F91D" },
  // Korea to Australia (Sydney)
  { order: 6, startLat: 37.5665, startLng: 126.9780, endLat: -33.8688, endLng: 151.2093, arcAlt: 0.25, color: "#F7F91D" },
  // Korea to Germany (Berlin)
  { order: 7, startLat: 37.5665, startLng: 126.9780, endLat: 52.5200, endLng: 13.4050, arcAlt: 0.4, color: "#F7F91D" },
  // Korea to France (Paris)
  { order: 8, startLat: 37.5665, startLng: 126.9780, endLat: 48.8566, endLng: 2.3522, arcAlt: 0.42, color: "#F7F91D" },
  // Korea to Thailand (Bangkok)
  { order: 9, startLat: 37.5665, startLng: 126.9780, endLat: 13.7563, endLng: 100.5018, arcAlt: 0.15, color: "#F7F91D" },
  // Korea to Indonesia (Jakarta)
  { order: 10, startLat: 37.5665, startLng: 126.9780, endLat: -6.2088, endLng: 106.8456, arcAlt: 0.2, color: "#F7F91D" },
  // Korea to Philippines (Manila)
  { order: 11, startLat: 37.5665, startLng: 126.9780, endLat: 14.5995, endLng: 120.9842, arcAlt: 0.12, color: "#F7F91D" },
  // Korea to India (Mumbai)
  { order: 12, startLat: 37.5665, startLng: 126.9780, endLat: 19.0760, endLng: 72.8777, arcAlt: 0.3, color: "#F7F91D" },
  // Korea to Mexico (Mexico City)
  { order: 13, startLat: 37.5665, startLng: 126.9780, endLat: 19.4326, endLng: -99.1332, arcAlt: 0.45, color: "#F7F91D" },
  // Korea to Canada (Toronto)
  { order: 14, startLat: 37.5665, startLng: 126.9780, endLat: 43.6532, endLng: -79.3832, arcAlt: 0.38, color: "#F7F91D" },
  // Korea to Singapore
  { order: 15, startLat: 37.5665, startLng: 126.9780, endLat: 1.3521, endLng: 103.8198, arcAlt: 0.18, color: "#F7F91D" },
  // Korea to South Africa (Johannesburg)
  { order: 16, startLat: 37.5665, startLng: 126.9780, endLat: -26.2041, endLng: 28.0473, arcAlt: 0.48, color: "#F7F91D" },
  // Korea to UAE (Dubai)
  { order: 17, startLat: 37.5665, startLng: 126.9780, endLat: 25.2048, endLng: 55.2708, arcAlt: 0.32, color: "#F7F91D" },
  // Korea to Russia (Moscow)
  { order: 18, startLat: 37.5665, startLng: 126.9780, endLat: 55.7558, endLng: 37.6173, arcAlt: 0.35, color: "#F7F91D" },
  // Korea to Spain (Madrid)
  { order: 19, startLat: 37.5665, startLng: 126.9780, endLat: 40.4168, endLng: -3.7038, arcAlt: 0.46, color: "#F7F91D" },
  // Korea to Italy (Rome)
  { order: 20, startLat: 37.5665, startLng: 126.9780, endLat: 41.9028, endLng: 12.4964, arcAlt: 0.43, color: "#F7F91D" },
  // Korea to Vietnam (Ho Chi Minh)
  { order: 21, startLat: 37.5665, startLng: 126.9780, endLat: 10.8231, endLng: 106.6297, arcAlt: 0.14, color: "#F7F91D" },
  // Korea to Malaysia (Kuala Lumpur)
  { order: 22, startLat: 37.5665, startLng: 126.9780, endLat: 3.1390, endLng: 101.6869, arcAlt: 0.16, color: "#F7F91D" },
  // Korea to Argentina (Buenos Aires)
  { order: 23, startLat: 37.5665, startLng: 126.9780, endLat: -34.6037, endLng: -58.3816, arcAlt: 0.55, color: "#F7F91D" },
  // Korea to Chile (Santiago)
  { order: 24, startLat: 37.5665, startLng: 126.9780, endLat: -33.4489, endLng: -70.6693, arcAlt: 0.52, color: "#F7F91D" },
  // Korea to USA (Chicago)
  { order: 25, startLat: 37.5665, startLng: 126.9780, endLat: 41.8781, endLng: -87.6298, arcAlt: 0.38, color: "#F7F91D" },
  // Korea to USA (Miami)
  { order: 26, startLat: 37.5665, startLng: 126.9780, endLat: 25.7617, endLng: -80.1918, arcAlt: 0.42, color: "#F7F91D" },
  // Korea to Netherlands (Amsterdam)
  { order: 27, startLat: 37.5665, startLng: 126.9780, endLat: 52.3676, endLng: 4.9041, arcAlt: 0.41, color: "#F7F91D" },
  // Korea to Sweden (Stockholm)
  { order: 28, startLat: 37.5665, startLng: 126.9780, endLat: 59.3293, endLng: 18.0686, arcAlt: 0.44, color: "#F7F91D" },
  // Korea to Turkey (Istanbul)
  { order: 29, startLat: 37.5665, startLng: 126.9780, endLat: 41.0082, endLng: 28.9784, arcAlt: 0.36, color: "#F7F91D" },
  // Korea to Egypt (Cairo)
  { order: 30, startLat: 37.5665, startLng: 126.9780, endLat: 30.0444, endLng: 31.2357, arcAlt: 0.38, color: "#F7F91D" },
];

const globeConfig = {
  pointSize: 1.2,
  globeColor: "#111111",
  showAtmosphere: true,
  atmosphereColor: "#ffffff",
  atmosphereAltitude: 0.2,
  emissive: "#000000",
  emissiveIntensity: 0.1,
  shininess: 0.9,
  polygonColor: "rgba(255,255,255,0.5)",
  ambientLight: "#ffffff",
  directionalLeftLight: "#ffffff",
  directionalTopLight: "#ffffff",
  pointLight: "#ffffff",
  arcTime: 1200,
  arcLength: 0.9,
  rings: 3,
  maxRings: 5,
  initialPosition: { lat: 37.5665, lng: 126.9780 },
  autoRotate: true,
  autoRotateSpeed: 0.8,
};

// Pre-generated particle positions to avoid Math.random() during render
const particlePositions = [
  { left: 15, top: 20 }, { left: 85, top: 15 }, { left: 25, top: 75 },
  { left: 70, top: 40 }, { left: 45, top: 60 }, { left: 90, top: 80 },
  { left: 10, top: 50 }, { left: 55, top: 25 }, { left: 35, top: 85 },
  { left: 75, top: 65 },
];

export function HeroSection({ lang }: HeroSectionProps) {
  const scrollToFeatures = () => {
    const element = document.getElementById("features");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Globe Background - Centered */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <div className="w-[min(80vh,80vw)] h-[min(80vh,80vw)] aspect-square">
          <World globeConfig={globeConfig} data={globeArcs} />
        </div>
        {/* Radial gradient overlay for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,black_65%)]" />
      </div>

      {/* Subtle glow effect behind globe */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] lg:w-[400px] lg:h-[400px] bg-white/[0.02] rounded-full blur-[60px] z-0"
      />

      {/* Top gradient */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black via-black/80 to-transparent z-10" />

      {/* Content Overlay */}
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#F7F91D]/10 backdrop-blur-sm border border-[#F7F91D]/30 rounded-full text-sm text-white/90">
            <Lightning size={16} weight="fill" className="text-[#F7F91D]" />
            {lang === "ko" ? "AI 영상 자동화의 미래" : "The Future of AI Video Automation"}
          </span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center"
        >
          <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white">
            {lang === "ko" ? "하나의 아이디어," : "One Idea,"}
          </span>
          <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[#F7F91D]">
            {lang === "ko" ? "수천 개의 영상" : "Thousands of Videos"}
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-6 text-lg sm:text-xl lg:text-2xl text-zinc-300 max-w-2xl text-center leading-relaxed"
        >
          {lang === "ko"
            ? "트렌드 분석부터 대량 생성, 글로벌 배포까지. AI가 브랜드 영상을 자동으로 완성합니다."
            : "From trend analysis to mass generation and global distribution. AI completes your brand videos automatically."}
        </motion.p>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-10 flex items-center gap-8 lg:gap-12"
        >
          <div className="text-center">
            <div className="text-3xl lg:text-4xl font-bold text-white">50+</div>
            <div className="text-sm text-zinc-500">{lang === "ko" ? "국가" : "Countries"}</div>
          </div>
          <div className="w-px h-12 bg-zinc-800" />
          <div className="text-center">
            <div className="text-3xl lg:text-4xl font-bold text-white">1000x</div>
            <div className="text-sm text-zinc-500">{lang === "ko" ? "콘텐츠 생성" : "Content Scale"}</div>
          </div>
          <div className="w-px h-12 bg-zinc-800" />
          <div className="text-center">
            <div className="text-3xl lg:text-4xl font-bold text-white">24/7</div>
            <div className="text-sm text-zinc-500">{lang === "ko" ? "자동화" : "Automation"}</div>
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-12 flex flex-col sm:flex-row items-center gap-4"
        >
          <Button
            asChild
            size="lg"
            className="bg-[#F7F91D] text-black hover:bg-[#F7F91D]/90 rounded-full px-8 py-6 text-base font-semibold transition-all hover:scale-105 group"
          >
            <Link href="/register">
              {lang === "ko" ? "무료로 시작하기" : "Start for Free"}
              <ArrowRight
                size={18}
                className="ml-2 group-hover:translate-x-1 transition-transform"
                weight="bold"
              />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-full px-8 py-6 text-base font-medium transition-all group"
          >
            <Link href="#how-it-works">
              <Play size={18} weight="fill" className="mr-2" />
              {lang === "ko" ? "작동 방식 보기" : "See How It Works"}
            </Link>
          </Button>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.5 }}
          onClick={scrollToFeatures}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-zinc-500 hover:text-white transition-colors"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-xs uppercase tracking-widest">
              {lang === "ko" ? "스크롤" : "Scroll"}
            </span>
            <div className="w-px h-8 bg-gradient-to-b from-white/50 to-transparent" />
          </motion.div>
        </motion.button>
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent z-10" />

      {/* Floating particles effect - subtle */}
      <div className="absolute inset-0 z-5 pointer-events-none">
        {particlePositions.map((pos, i) => (
          <motion.div
            key={i}
            className="absolute w-0.5 h-0.5 bg-white/20 rounded-full"
            style={{
              left: `${pos.left}%`,
              top: `${pos.top}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 4 + i * 0.3,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </section>
  );
}
