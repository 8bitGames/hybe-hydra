"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface KeywordInputPopoverProps {
  onAdd: (value: string) => void;
  placeholder?: string;
  buttonText?: string;
  className?: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function KeywordInputPopover({
  onAdd,
  placeholder = "Enter keyword...",
  buttonText = "Add",
  className,
  disabled = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: KeywordInputPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback((open: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(open);
    } else {
      setInternalOpen(open);
    }
  }, [isControlled, controlledOnOpenChange]);

  // Auto-focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleAdd = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      onAdd(trimmedValue);
      setInputValue("");
      setOpen(false);
    }
  }, [inputValue, onAdd, setOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      } else if (e.key === "Escape") {
        setOpen(false);
        setInputValue("");
      }
    },
    [handleAdd, setOpen]
  );

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setInputValue("");
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 border border-dashed border-neutral-300 rounded-full hover:border-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
        >
          <Plus className="h-3 w-3" />
          {buttonText}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-64 p-3"
      >
        <div className="flex flex-col gap-3">
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-9 text-sm bg-neutral-50 border-neutral-200 focus:border-neutral-400 focus:ring-1 focus:ring-neutral-300"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 rounded border border-neutral-200 hover:border-neutral-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!inputValue.trim()}
              className="px-4 py-1.5 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
