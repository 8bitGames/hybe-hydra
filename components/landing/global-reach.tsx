"use client";

import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { GlobeHemisphereWest } from "@phosphor-icons/react";
import { type Language } from "@/lib/i18n/landing";

// Dynamically import Globe to avoid SSR issues with Three.js
const World = dynamic(() => import("@/components/ui/globe").then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  ),
});

interface GlobalReachProps {
  lang: Language;
}

// Arc data - videos spreading from Korea to the world
const sampleArcs = [
  // Korea (Seoul) to USA (New York)
  { order: 1, startLat: 37.5665, startLng: 126.9780, endLat: 40.7128, endLng: -74.0060, arcAlt: 0.35, color: "#ffffff" },
  // Korea to USA (Los Angeles)
  { order: 2, startLat: 37.5665, startLng: 126.9780, endLat: 34.0522, endLng: -118.2437, arcAlt: 0.4, color: "#ffffff" },
  // Korea to Japan (Tokyo)
  { order: 3, startLat: 37.5665, startLng: 126.9780, endLat: 35.6762, endLng: 139.6503, arcAlt: 0.1, color: "#ffffff" },
  // Korea to UK (London)
  { order: 4, startLat: 37.5665, startLng: 126.9780, endLat: 51.5074, endLng: -0.1278, arcAlt: 0.45, color: "#ffffff" },
  // Korea to Brazil (Sao Paulo)
  { order: 5, startLat: 37.5665, startLng: 126.9780, endLat: -23.5505, endLng: -46.6333, arcAlt: 0.5, color: "#ffffff" },
  // Korea to Australia (Sydney)
  { order: 6, startLat: 37.5665, startLng: 126.9780, endLat: -33.8688, endLng: 151.2093, arcAlt: 0.25, color: "#ffffff" },
  // Korea to Germany (Berlin)
  { order: 7, startLat: 37.5665, startLng: 126.9780, endLat: 52.5200, endLng: 13.4050, arcAlt: 0.4, color: "#ffffff" },
  // Korea to France (Paris)
  { order: 8, startLat: 37.5665, startLng: 126.9780, endLat: 48.8566, endLng: 2.3522, arcAlt: 0.42, color: "#ffffff" },
  // Korea to Thailand (Bangkok)
  { order: 9, startLat: 37.5665, startLng: 126.9780, endLat: 13.7563, endLng: 100.5018, arcAlt: 0.15, color: "#ffffff" },
  // Korea to Indonesia (Jakarta)
  { order: 10, startLat: 37.5665, startLng: 126.9780, endLat: -6.2088, endLng: 106.8456, arcAlt: 0.2, color: "#ffffff" },
  // Korea to Philippines (Manila)
  { order: 11, startLat: 37.5665, startLng: 126.9780, endLat: 14.5995, endLng: 120.9842, arcAlt: 0.12, color: "#ffffff" },
  // Korea to India (Mumbai)
  { order: 12, startLat: 37.5665, startLng: 126.9780, endLat: 19.0760, endLng: 72.8777, arcAlt: 0.3, color: "#ffffff" },
  // Korea to Mexico (Mexico City)
  { order: 13, startLat: 37.5665, startLng: 126.9780, endLat: 19.4326, endLng: -99.1332, arcAlt: 0.45, color: "#ffffff" },
  // Korea to Canada (Toronto)
  { order: 14, startLat: 37.5665, startLng: 126.9780, endLat: 43.6532, endLng: -79.3832, arcAlt: 0.38, color: "#ffffff" },
  // Korea to Singapore
  { order: 15, startLat: 37.5665, startLng: 126.9780, endLat: 1.3521, endLng: 103.8198, arcAlt: 0.18, color: "#ffffff" },
];

const globeConfig = {
  pointSize: 1,
  globeColor: "#0a0a0a",
  showAtmosphere: true,
  atmosphereColor: "#ffffff",
  atmosphereAltitude: 0.15,
  emissive: "#000000",
  emissiveIntensity: 0.05,
  shininess: 0.9,
  polygonColor: "rgba(255,255,255,0.5)",
  ambientLight: "#ffffff",
  directionalLeftLight: "#ffffff",
  directionalTopLight: "#ffffff",
  pointLight: "#ffffff",
  arcTime: 2000,
  arcLength: 0.9,
  rings: 1,
  maxRings: 3,
  initialPosition: { lat: 37.5665, lng: 126.9780 }, // Seoul
  autoRotate: true,
  autoRotateSpeed: 0.5,
};

export function GlobalReach({ lang }: GlobalReachProps) {
  return (
    <section className="relative bg-black py-24 lg:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-full mb-6">
              <GlobeHemisphereWest size={14} weight="bold" />
              {lang === "ko" ? "글로벌 도달" : "Global Reach"}
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              {lang === "ko" ? "전 세계로 퍼져나가는" : "Your Content,"}
            </h2>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-500 mb-6">
              {lang === "ko" ? "콘텐츠" : "Everywhere"}
            </h2>

            <p className="text-lg text-zinc-400 leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
              {lang === "ko"
                ? "AI가 생성한 영상이 TikTok, Instagram, YouTube를 통해 전 세계 팬들에게 실시간으로 전달됩니다. 지역별 트렌드에 최적화된 콘텐츠로 글로벌 시장을 동시에 공략하세요."
                : "AI-generated videos reach fans worldwide through TikTok, Instagram, and YouTube in real-time. Target global markets simultaneously with content optimized for regional trends."}
            </p>

            <div className="grid grid-cols-3 gap-6 max-w-md mx-auto lg:mx-0">
              <div className="text-center lg:text-left">
                <div className="text-3xl lg:text-4xl font-bold text-white">50+</div>
                <div className="text-sm text-zinc-500">
                  {lang === "ko" ? "지원 국가" : "Countries"}
                </div>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-3xl lg:text-4xl font-bold text-white">3</div>
                <div className="text-sm text-zinc-500">
                  {lang === "ko" ? "플랫폼" : "Platforms"}
                </div>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-3xl lg:text-4xl font-bold text-white">24/7</div>
                <div className="text-sm text-zinc-500">
                  {lang === "ko" ? "실시간 배포" : "Real-time"}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Globe */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative h-[400px] lg:h-[500px]"
          >
            <div className="absolute inset-0">
              <World globeConfig={globeConfig} data={sampleArcs} />
            </div>

            {/* Glow effect behind globe */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl pointer-events-none" />
          </motion.div>
        </div>
      </div>

      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black to-black pointer-events-none" />
    </section>
  );
}
