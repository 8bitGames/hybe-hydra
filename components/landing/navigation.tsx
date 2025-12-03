"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { List, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { type Language, getTranslation } from "@/lib/i18n/landing";
import { cn } from "@/lib/utils";

interface NavigationProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
}

export function Navigation({ lang, onLanguageChange }: NavigationProps) {
  const t = getTranslation(lang);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-border shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <span className="text-2xl lg:text-3xl font-bold tracking-tight transition-all duration-200 group-hover:scale-105 text-foreground">
              Hydra
            </span>
          </Link>

          {/* Desktop Navigation - Center */}
          <div className="hidden lg:flex items-center justify-center gap-8 absolute left-1/2 -translate-x-1/2">
            <button
              onClick={() => scrollToSection("features")}
              className="text-sm font-medium transition-all duration-200 relative group text-foreground hover:text-foreground/80"
            >
              {t.nav.features}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-200 group-hover:w-full bg-foreground" />
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="text-sm font-medium transition-all duration-200 relative group text-foreground hover:text-foreground/80"
            >
              {t.nav.howItWorks}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-200 group-hover:w-full bg-foreground" />
            </button>
            <button
              onClick={() => scrollToSection("use-cases")}
              className="text-sm font-medium transition-all duration-200 relative group text-foreground hover:text-foreground/80"
            >
              {t.nav.useCases}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-200 group-hover:w-full bg-foreground" />
            </button>
          </div>

          {/* Desktop - Right Side */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Language Toggle */}
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={() => onLanguageChange("ko")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded-full",
                  lang === "ko"
                    ? "bg-foreground text-background"
                    : "text-foreground border border-foreground/30 hover:bg-muted"
                )}
              >
                KR
              </button>
              <button
                onClick={() => onLanguageChange("en")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded-full",
                  lang === "en"
                    ? "bg-foreground text-background"
                    : "text-foreground border border-foreground/30 hover:bg-muted"
                )}
              >
                EN
              </button>
            </div>

            {/* Login */}
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 transition-all duration-200 rounded-full text-foreground border border-foreground/30 hover:bg-muted"
            >
              {lang === "ko" ? "로그인" : "Login"}
            </Link>

            {/* Sign Up */}
            <Button
              asChild
              size="sm"
              className="rounded-full px-5 font-medium transition-all duration-200 hover:scale-105 bg-foreground text-background hover:bg-foreground/90"
            >
              <Link href="/register">
                {lang === "ko" ? "시작하기" : "Get Started"}
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg transition-all duration-200 hover:scale-110 hover:bg-muted/50"
          >
            {mobileMenuOpen ? (
              <X size={24} weight="bold" className="text-foreground" />
            ) : (
              <List size={24} weight="bold" className="text-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="lg:hidden bg-background border-b border-border"
        >
          <div className="px-4 py-6 space-y-4">
            <button
              onClick={() => scrollToSection("features")}
              className="block w-full text-left text-foreground hover:text-muted-foreground py-2 font-medium"
            >
              {t.nav.features}
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="block w-full text-left text-foreground hover:text-muted-foreground py-2 font-medium"
            >
              {t.nav.howItWorks}
            </button>
            <button
              onClick={() => scrollToSection("use-cases")}
              className="block w-full text-left text-foreground hover:text-muted-foreground py-2 font-medium"
            >
              {t.nav.useCases}
            </button>

            <div className="pt-4 border-t border-border space-y-3">
              {/* Language */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onLanguageChange("ko")}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    lang === "ko"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground border border-border"
                  )}
                >
                  KR
                </button>
                <button
                  onClick={() => onLanguageChange("en")}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    lang === "en"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground border border-border"
                  )}
                >
                  EN
                </button>
              </div>

              {/* Auth Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 rounded-full"
                >
                  <Link href="/login">
                    {lang === "ko" ? "로그인" : "Login"}
                  </Link>
                </Button>
                <Button
                  asChild
                  className="flex-1 rounded-full bg-foreground text-background hover:bg-foreground/90"
                >
                  <Link href="/register">
                    {lang === "ko" ? "시작하기" : "Get Started"}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
