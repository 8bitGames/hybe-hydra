"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Settings, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const settingsNavItems = [
  {
    name: { ko: "계정", en: "Accounts" },
    href: "/settings/accounts",
    icon: Users,
    description: { ko: "연결된 소셜 계정 관리", en: "Manage connected social accounts" },
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
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Settings className="h-8 w-8" />
          {isKorean ? "설정" : "Settings"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isKorean
            ? "계정 설정 및 환경 설정을 관리하세요"
            : "Manage your account settings and preferences"}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <nav className="w-full md:w-64 shrink-0">
          <div className="space-y-1">
            {settingsNavItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 h-auto py-3",
                      isActive && "bg-secondary"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <div className="text-left">
                      <div className="font-medium">{isKorean ? item.name.ko : item.name.en}</div>
                      <div className="text-xs text-muted-foreground font-normal">
                        {isKorean ? item.description.ko : item.description.en}
                      </div>
                    </div>
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
