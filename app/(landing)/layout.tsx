import type { Metadata } from "next";
import { LandingI18nWrapper } from "./i18n-wrapper";

export const metadata: Metadata = {
  title: "HYDRA - Enterprise AI Video Platform",
  description: "AI-powered video orchestration platform for enterprise brands. Create thousands of brand videos in minutes with trend intelligence, brand IP integration, and multi-platform publishing.",
  keywords: ["AI video", "video generation", "brand content", "TikTok", "social media automation", "enterprise video"],
  openGraph: {
    title: "HYDRA - Enterprise AI Video Platform",
    description: "Create thousands of brand videos in minutes with AI",
    type: "website",
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LandingI18nWrapper>
      <div className="min-h-screen">
        {children}
      </div>
    </LandingI18nWrapper>
  );
}
