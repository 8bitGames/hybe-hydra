"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoButtonProps {
  content: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  size?: "sm" | "md";
}

export function InfoButton({
  content,
  className,
  side = "top",
  size = "sm",
}: InfoButtonProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-200",
            sizeClasses[size],
            className
          )}
          aria-label="More information"
        >
          <Info className={cn(size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4")} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        className="max-w-[280px] text-left"
      >
        <p className="text-xs leading-relaxed">{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}
