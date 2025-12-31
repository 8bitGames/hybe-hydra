"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { GlobalJobTracker } from "@/components/shared/GlobalJobTracker";

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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
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
                <span className="text-3xl font-bold tracking-tight">HYDRA</span>
              </div>
              <MainNavigation mobile />
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/trend-dashboard" className="flex items-center gap-2">
            <span className="text-3xl font-bold tracking-tight">HYDRA</span>
          </Link>

          {/* Navigation */}
          <MainNavigation className="hidden md:flex ml-8" />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Global Job Tracker - Processing Shortcut */}
            <GlobalJobTracker />

            <Separator orientation="vertical" className="h-6" />

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
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
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
  // Subscribe to each property individually to ensure re-renders on hydration state changes
  const _hasHydrated = useAuthStore((state) => state._hasHydrated);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const logout = useAuthStore((state) => state.logout);
  const fetchUser = useAuthStore((state) => state.fetchUser);

  useEffect(() => {
    console.log("[DashboardLayout] Auth state:", {
      _hasHydrated,
      isAuthenticated,
      hasUser: !!user,
      isLoading,
    });

    // Hydration이 완료될 때까지 대기
    if (!_hasHydrated) {
      console.log("[DashboardLayout] Waiting for hydration...");
      return;
    }

    const checkAuth = async () => {
      console.log("[DashboardLayout] Checking auth...", { isAuthenticated, hasUser: !!user });
      if (!isAuthenticated) {
        console.log("[DashboardLayout] Not authenticated, redirecting to login...");
        // Use window.location for more reliable redirect when component unmounts
        window.location.href = "/login";
        return;
      }
      if (!user) {
        console.log("[DashboardLayout] No user, fetching...");
        await fetchUser();
      }
    };
    checkAuth();
  }, [_hasHydrated, isAuthenticated, user, router, fetchUser, isLoading]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Wait for hydration first
  if (!_hasHydrated) {
    console.log("[DashboardLayout] Waiting for hydration...");
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // If not authenticated, useEffect will handle redirect
  // Return null to allow navigation to happen
  if (!isAuthenticated) {
    console.log("[DashboardLayout] Not authenticated, allowing redirect...");
    return null;
  }

  // If authenticated but loading or no user yet, show loading
  if (isLoading || !user) {
    console.log("[DashboardLayout] Loading user data...");
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
