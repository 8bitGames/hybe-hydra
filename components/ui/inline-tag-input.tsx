"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InlineTagInputProps {
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  placeholder?: string;
  addButtonText?: string;
  maxTags?: number;
  className?: string;
  tagClassName?: string;
  variant?: "default" | "outline" | "secondary";
  prefix?: string; // e.g., "#" for hashtags
}

export function InlineTagInput({
  tags,
  onAddTag,
  onRemoveTag,
  placeholder = "Enter tag...",
  addButtonText = "Add",
  maxTags = 20,
  className,
  tagClassName,
  variant = "secondary",
  prefix = "",
}: InlineTagInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure popover is fully rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleAddTag = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !tags.includes(trimmedValue) && tags.length < maxTags) {
      onAddTag(trimmedValue);
      setInputValue("");
      // Keep popover open for adding more tags
    }
  }, [inputValue, tags, maxTags, onAddTag]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setInputValue("");
      }
    },
    [handleAddTag]
  );

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setInputValue("");
    }
  };

  const canAddMore = tags.length < maxTags;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant={variant}
          className={cn(
            "text-xs py-0.5 pr-1 flex items-center gap-1",
            tagClassName
          )}
        >
          {prefix}
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveTag(tag);
            }}
            className="ml-0.5 hover:text-red-400 transition-colors"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {canAddMore && (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 border border-dashed border-neutral-300 rounded-full hover:border-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <Plus className="h-3 w-3" />
              {addButtonText}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={4}
            className="w-56 p-2"
          >
            <div className="flex flex-col gap-2">
              <Input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="h-8 text-sm"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  {tags.length}/{maxTags}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenChange(false)}
                    className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                  >
                    Esc
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={!inputValue.trim()}
                    className="px-3 py-1 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Enter
                  </button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
