"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Sparkles,
  FolderOpen,
  TrendingUp,
  ChevronDown,
  Bot,
  Wand2,
  Layers,
  PlayCircle,
  Send,
  Zap,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  items?: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }[];
}

const navigationItems: NavItem[] = [
  {
    name: "Home",
    href: "/home",
    icon: Home,
  },
  {
    name: "Create",
    icon: Sparkles,
    items: [
      {
        name: "AI Generate",
        href: "/create/generate",
        icon: Bot,
        description: "AI creates video from prompt",
      },
      {
        name: "Image Compose",
        href: "/create/compose",
        icon: Wand2,
        description: "Combine images + audio",
      },
      {
        name: "Batch Variations",
        href: "/create/batch",
        icon: Layers,
        description: "Generate multiple versions",
      },
    ],
  },
  {
    name: "Manage",
    icon: FolderOpen,
    items: [
      {
        name: "Campaigns",
        href: "/campaigns",
        icon: FolderOpen,
        description: "Organize your projects",
      },
      {
        name: "All Videos",
        href: "/videos",
        icon: PlayCircle,
        description: "Browse all generated videos",
      },
      {
        name: "Publishing",
        href: "/publishing",
        icon: Send,
        description: "Schedule & publish to SNS",
      },
    ],
  },
  {
    name: "Insights",
    href: "/insights",
    icon: TrendingUp,
  },
];

interface MainNavigationProps {
  className?: string;
  mobile?: boolean;
}

export function MainNavigation({ className, mobile }: MainNavigationProps) {
  const pathname = usePathname();

  const isActive = (href?: string, items?: NavItem["items"]) => {
    if (href) {
      return pathname === href || pathname?.startsWith(href + "/");
    }
    if (items) {
      return items.some(
        (item) => pathname === item.href || pathname?.startsWith(item.href + "/")
      );
    }
    return false;
  };

  if (mobile) {
    return (
      <nav className={cn("flex flex-col gap-1", className)}>
        {navigationItems.map((item) => (
          <div key={item.name}>
            {item.href ? (
              <Link href={item.href}>
                <Button
                  variant={isActive(item.href) ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            ) : (
              <>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </div>
                <div className="ml-6 space-y-1">
                  {item.items?.map((subItem) => (
                    <Link key={subItem.href} href={subItem.href}>
                      <Button
                        variant={isActive(subItem.href) ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2 text-sm"
                        size="sm"
                      >
                        <subItem.icon className="h-4 w-4" />
                        {subItem.name}
                      </Button>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {navigationItems.map((item) => {
        if (item.href) {
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={isActive(item.href) ? "secondary" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Button>
            </Link>
          );
        }

        return (
          <DropdownMenu key={item.name}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={isActive(undefined, item.items) ? "secondary" : "ghost"}
                size="sm"
                className="gap-2"
              >
                <item.icon className="h-4 w-4" />
                {item.name}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>{item.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.items?.map((subItem) => (
                <DropdownMenuItem key={subItem.href} asChild>
                  <Link
                    href={subItem.href}
                    className="flex items-start gap-3 cursor-pointer"
                  >
                    <subItem.icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{subItem.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {subItem.description}
                      </div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
