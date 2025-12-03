"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  GlobeHemisphereWest,
  ArrowUp
} from "@phosphor-icons/react";
import { type Language, getTranslation } from "@/lib/i18n/landing";

interface FooterProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
}

export function Footer({ lang, onLanguageChange }: FooterProps) {
  const t = getTranslation(lang);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative bg-black text-zinc-400 py-16 lg:py-20 border-t border-zinc-900">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          {/* Logo & Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-5"
          >
            <Link href="/" className="inline-block mb-6 group">
              <span className="text-3xl font-bold text-white tracking-tight group-hover:text-zinc-300 transition-colors">
                Hydra
              </span>
            </Link>
            <p className="text-sm text-zinc-500 max-w-md leading-relaxed mb-6">
              {lang === "ko"
                ? "AI 기반 엔터프라이즈 비디오 오케스트레이션 플랫폼. 글로벌 시장을 위한 숏폼 콘텐츠를 자동으로 생성하고 배포합니다."
                : "Enterprise AI Video Orchestration Platform. Automatically generate and distribute short-form content for global markets."}
            </p>

          </motion.div>

          {/* Navigation Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <h4 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">
              {lang === "ko" ? "탐색" : "Navigation"}
            </h4>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={() => scrollToSection("features")}
                  className="text-sm hover:text-white transition-colors hover:translate-x-1 inline-block transform duration-200"
                >
                  {t.footer.features}
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("how-it-works")}
                  className="text-sm hover:text-white transition-colors hover:translate-x-1 inline-block transform duration-200"
                >
                  {t.footer.howItWorks}
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("use-cases")}
                  className="text-sm hover:text-white transition-colors hover:translate-x-1 inline-block transform duration-200"
                >
                  {t.footer.useCases}
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("cta")}
                  className="text-sm hover:text-white transition-colors hover:translate-x-1 inline-block transform duration-200"
                >
                  {t.footer.contact}
                </button>
              </li>
            </ul>
          </motion.div>

          {/* Legal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <h4 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider">
              {lang === "ko" ? "법적 고지" : "Legal"}
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/terms"
                  className="text-sm hover:text-white transition-colors hover:translate-x-1 inline-block transform duration-200"
                >
                  {t.footer.terms}
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm hover:text-white transition-colors hover:translate-x-1 inline-block transform duration-200"
                >
                  {t.footer.privacy}
                </Link>
              </li>
            </ul>
          </motion.div>

          {/* Language & Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="lg:col-span-3"
          >
            <h4 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider flex items-center gap-2">
              <GlobeHemisphereWest size={16} weight="bold" />
              {lang === "ko" ? "언어" : "Language"}
            </h4>
            <div className="flex gap-2 mb-8">
              <button
                onClick={() => onLanguageChange("ko")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  lang === "ko"
                    ? "bg-white text-black"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800"
                }`}
              >
                한국어
              </button>
              <button
                onClick={() => onLanguageChange("en")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  lang === "en"
                    ? "bg-white text-black"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800"
                }`}
              >
                English
              </button>
            </div>

            {/* Auth Links */}
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                {lang === "ko" ? "로그인" : "Sign In"}
              </Link>
              <span className="w-px h-4 bg-zinc-700" />
              <Link
                href="/register"
                className="text-sm text-white bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg transition-colors"
              >
                {lang === "ko" ? "시작하기" : "Get Started"}
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Business Information */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 pt-8 border-t border-zinc-900"
        >
          <div className="text-xs text-zinc-600 space-y-1">
            <p>
              <span className="font-medium text-zinc-500">이온스튜디오 주식회사</span>
              <span className="mx-2 text-zinc-800">|</span>
              대표이사 : 강지원
              <span className="mx-2 text-zinc-800">|</span>
              사업자등록번호 : 440-81-02170
            </p>
            <p>
              주소 : 서울특별시 강남구 봉은사로22길 45-9, 제44호실 (역삼동, 논스1호점)
            </p>
          </div>
        </motion.div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">
            Copyright &copy; {new Date().getFullYear()} AEON STUDIO Co., Ltd. All Rights Reserved.
          </p>

          {/* Back to Top */}
          <button
            onClick={scrollToTop}
            className="group flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors"
          >
            {lang === "ko" ? "맨 위로" : "Back to top"}
            <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
              <ArrowUp size={14} weight="bold" className="group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </button>
        </div>
      </div>
    </footer>
  );
}
