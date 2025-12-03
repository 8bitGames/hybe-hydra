"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "motion/react";
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
  const [visible, setVisible] = useState(true);
  const { scrollYProgress } = useScroll();

  useMotionValueEvent(scrollYProgress, "change", (current) => {
    if (typeof current === "number") {
      const direction = current - scrollYProgress.getPrevious()!;
      if (scrollYProgress.get() < 0.05) {
        setVisible(true);
      } else {
        if (direction < 0) {
          setVisible(true);
        } else {
          setVisible(false);
        }
      }
    }
  });

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  const navItems = [
    { name: t.nav.features, id: "features" },
    { name: t.nav.howItWorks, id: "how-it-works" },
    { name: t.nav.useCases, id: "use-cases" },
  ];

  return (
    <>
      {/* Desktop Floating Nav */}
      <AnimatePresence mode="wait">
        <motion.nav
          initial={{ opacity: 1, y: 0 }}
          animate={{ y: visible ? 0 : -100, opacity: visible ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed top-4 inset-x-0 mx-auto z-[5000]",
            "hidden lg:flex max-w-fit items-center justify-center",
            "px-8 py-3 rounded-full",
            "border border-white/10 bg-black/80 backdrop-blur-md",
            "shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]"
          )}
        >
          {/* Logo */}
          <Link href="/" className="mr-8">
            <span className="text-xl font-bold text-white tracking-tight">
              Hydra
            </span>
          </Link>

          {/* Nav Items */}
          <div className="flex items-center gap-6 mr-8">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                {item.name}
              </button>
            ))}
          </div>

          {/* Language Toggle */}
          <div className="flex items-center gap-1 mr-4">
            <button
              onClick={() => onLanguageChange("ko")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full transition-all",
                lang === "ko"
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              KR
            </button>
            <button
              onClick={() => onLanguageChange("en")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full transition-all",
                lang === "en"
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              EN
            </button>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 transition-colors"
            >
              {lang === "ko" ? "로그인" : "Login"}
            </Link>
            <Button
              asChild
              size="sm"
              className="rounded-full bg-white text-black hover:bg-zinc-200 px-4 text-sm font-medium"
            >
              <Link href="/register">
                {lang === "ko" ? "시작하기" : "Get Started"}
              </Link>
            </Button>
          </div>
        </motion.nav>
      </AnimatePresence>

      {/* Mobile Nav */}
      <nav
        className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <span className="text-xl font-bold text-white tracking-tight">
                Hydra
              </span>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? (
                <X size={24} weight="bold" />
              ) : (
                <List size={24} weight="bold" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-black border-t border-white/10"
            >
              <div className="px-4 py-6 space-y-4">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="block w-full text-left text-white hover:text-zinc-400 py-2 font-medium"
                  >
                    {item.name}
                  </button>
                ))}

                <div className="pt-4 border-t border-white/10 space-y-3">
                  {/* Language */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onLanguageChange("ko")}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                        lang === "ko"
                          ? "bg-white text-black"
                          : "text-zinc-400 border border-white/20"
                      )}
                    >
                      KR
                    </button>
                    <button
                      onClick={() => onLanguageChange("en")}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                        lang === "en"
                          ? "bg-white text-black"
                          : "text-zinc-400 border border-white/20"
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
                      className="flex-1 rounded-full border-white/20 text-white hover:bg-white/10"
                    >
                      <Link href="/login">
                        {lang === "ko" ? "로그인" : "Login"}
                      </Link>
                    </Button>
                    <Button
                      asChild
                      className="flex-1 rounded-full bg-white text-black hover:bg-zinc-200"
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
        </AnimatePresence>
      </nav>
    </>
  );
}
