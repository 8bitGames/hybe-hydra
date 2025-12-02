"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BilingualLabel, type BilingualText } from "./BilingualLabel";

interface CollapsiblePanelProps {
  title: BilingualText;
  badge?: BilingualText | string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  onToggle?: (isOpen: boolean) => void;
}

/**
 * A collapsible panel for progressive disclosure of settings
 * 설정의 점진적 공개를 위한 접을 수 있는 패널
 *
 * @example
 * <CollapsiblePanel
 *   title={{ ko: "고급 설정", en: "Advanced Settings" }}
 *   badge={{ ko: "선택", en: "Optional" }}
 *   defaultOpen={false}
 * >
 *   <AdvancedSettingsContent />
 * </CollapsiblePanel>
 */
export function CollapsiblePanel({
  title,
  badge,
  badgeVariant = "outline",
  defaultOpen = false,
  children,
  className,
  headerClassName,
  contentClassName,
  onToggle,
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = useCallback(() => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  }, [isOpen, onToggle]);

  return (
    <div className={cn("border rounded-lg", className)}>
      {/* Header - always visible */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3",
          "hover:bg-accent/50 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isOpen && "border-b",
          headerClassName
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">
            <BilingualLabel ko={title.ko} en={title.en} />
          </span>
        </div>

        {badge && (
          <Badge variant={badgeVariant} className="text-xs">
            {typeof badge === "string" ? (
              badge
            ) : (
              <BilingualLabel ko={badge.ko} en={badge.en} />
            )}
          </Badge>
        )}
      </button>

      {/* Content - collapsible */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className={cn("p-4", contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Controlled version of CollapsiblePanel
 * 제어 버전의 CollapsiblePanel
 */
interface ControlledCollapsiblePanelProps extends Omit<CollapsiblePanelProps, "defaultOpen" | "onToggle"> {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ControlledCollapsiblePanel({
  isOpen,
  onOpenChange,
  ...props
}: ControlledCollapsiblePanelProps) {
  return (
    <div className={cn("border rounded-lg", props.className)}>
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3",
          "hover:bg-accent/50 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isOpen && "border-b",
          props.headerClassName
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">
            <BilingualLabel ko={props.title.ko} en={props.title.en} />
          </span>
        </div>

        {props.badge && (
          <Badge variant={props.badgeVariant || "outline"} className="text-xs">
            {typeof props.badge === "string" ? (
              props.badge
            ) : (
              <BilingualLabel ko={props.badge.ko} en={props.badge.en} />
            )}
          </Badge>
        )}
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className={cn("p-4", props.contentClassName)}>
          {props.children}
        </div>
      </div>
    </div>
  );
}
