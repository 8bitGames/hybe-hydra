"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Users, Music } from "lucide-react";

const settingsTabs = [
  {
    id: "accounts",
    href: "/settings/accounts",
    icon: Users,
    labelKo: "계정 연결",
    labelEn: "Connected Accounts",
  },
  {
    id: "artists",
    href: "/settings/artists",
    icon: Music,
    labelKo: "아티스트 관리",
    labelEn: "Artists",
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { language } = useI18n();
  const isKorean = language === "ko";

  return (
    <div className="space-y-6 pb-8 px-[7%]">
      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex gap-6" aria-label="Settings tabs">
          {settingsTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {isKorean ? tab.labelKo : tab.labelEn}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
