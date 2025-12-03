"use client";

import Link from "next/link";
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

  return (
    <footer className="bg-zinc-950 text-zinc-400 py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Logo & Description */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <span className="text-2xl font-bold text-white tracking-tight">
                Hydra
              </span>
            </Link>
            <p className="text-sm text-zinc-500 max-w-md">
              Enterprise AI Video Orchestration Platform
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">Navigation</h4>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={() => scrollToSection("features")}
                  className="text-sm hover:text-white transition-colors"
                >
                  {t.footer.features}
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("how-it-works")}
                  className="text-sm hover:text-white transition-colors"
                >
                  {t.footer.howItWorks}
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("use-cases")}
                  className="text-sm hover:text-white transition-colors"
                >
                  {t.footer.useCases}
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("cta")}
                  className="text-sm hover:text-white transition-colors"
                >
                  {t.footer.contact}
                </button>
              </li>
            </ul>
          </div>

          {/* Legal & Language */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/terms" className="text-sm hover:text-white transition-colors">
                  {t.footer.terms}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm hover:text-white transition-colors">
                  {t.footer.privacy}
                </Link>
              </li>
            </ul>

            {/* Language */}
            <div className="mt-6">
              <h4 className="text-white font-semibold mb-3 text-sm">Language</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => onLanguageChange("ko")}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    lang === "ko"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  KR
                </button>
                <button
                  onClick={() => onLanguageChange("en")}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    lang === "en"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Business Information */}
        <div className="mt-12 pt-8 border-t border-zinc-800">
          <div className="text-xs text-zinc-600 space-y-1">
            <p>
              <span className="font-medium text-zinc-500">이온스튜디오 주식회사</span>
              <span className="mx-2">|</span>
              대표이사 : 강지원
              <span className="mx-2">|</span>
              사업자등록번호 : 440-81-02170
            </p>
            <p>
              주소 : 서울특별시 강남구 봉은사로22길 45-9, 제44호실 (역삼동, 논스1호점)
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-6 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">
            Copyright &copy; AEON STUDIO Co., Ltd. All Rights Reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              {lang === "ko" ? "로그인" : "Sign In"}
            </Link>
            <span className="w-1 h-1 bg-zinc-700 rounded-full" />
            <Link
              href="/register"
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              {lang === "ko" ? "회원가입" : "Register"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
