"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/lib/auth-store";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider, LanguageSwitcher, useI18n } from "@/lib/i18n";
import { QueryProvider } from "@/lib/query-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  User,
  ChevronDown,
  Menu,
  Settings,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MainNavigation } from "@/components/layout/main-navigation";

function DashboardContent({
  children,
  user,
  handleLogout,
}: {
  children: React.ReactNode;
  user: any;
  handleLogout: () => void;
}) {
  const router = useRouter();
  const { language } = useI18n();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-28">
        <div className="flex h-full items-center px-4">
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden mr-2">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <div className="flex items-center gap-2 mb-6">
                <Image
                  src="/Vector.png"
                  alt="HYDRA"
                  width={200}
                  height={200}
                  className="h-16 w-auto"
                />
              </div>
              <MainNavigation mobile />
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/home" className="flex items-center gap-2">
            <Image
              src="/Vector.png"
              alt="HYDRA"
              width={200}
              height={200}
              className="h-20 w-auto"
            />
          </Link>

          {/* Navigation */}
          <MainNavigation className="hidden md:flex ml-8" />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right Side */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />

            <Separator orientation="vertical" className="h-6 mx-2" />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs bg-muted">
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline-block font-medium">
                    {user.name}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {user.role}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings/accounts")}>
                  <Settings className="mr-2 h-4 w-4" />
                  {language === "ko" ? "설정" : "Settings"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {language === "ko" ? "로그아웃" : "Logout"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, fetchUser, _hasHydrated } = useAuthStore();

  useEffect(() => {
    // Hydration이 완료될 때까지 대기
    if (!_hasHydrated) return;

    const checkAuth = async () => {
      if (!isAuthenticated) {
        router.push("/login");
        return;
      }
      if (!user) {
        await fetchUser();
      }
    };
    checkAuth();
  }, [_hasHydrated, isAuthenticated, user, router, fetchUser]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Hydration 또는 로딩 중이거나 user가 없으면 로딩 표시
  if (!_hasHydrated || isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <QueryProvider>
      <I18nProvider>
        <ToastProvider>
          <DashboardContent user={user} handleLogout={handleLogout}>
            {children}
          </DashboardContent>
        </ToastProvider>
      </I18nProvider>
    </QueryProvider>
  );
}
