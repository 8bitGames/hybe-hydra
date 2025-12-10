"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useKeywordHistory } from "@/lib/hooks/useKeywordHistory";

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
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { addToHistory, getSuggestions } = useKeywordHistory();

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

  // Get suggestions based on current input
  const suggestions = getSuggestions(inputValue, 8);
  const showSuggestions = suggestions.length > 0;

  // Auto-focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset selected index when input changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [inputValue]);

  const handleAdd = useCallback((value?: string) => {
    const trimmedValue = (value || inputValue).trim();
    if (trimmedValue) {
      onAdd(trimmedValue);
      addToHistory(trimmedValue);
      setInputValue("");
      setSelectedIndex(-1);
      setOpen(false);
    }
  }, [inputValue, onAdd, addToHistory, setOpen]);

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    handleAdd(suggestion);
  }, [handleAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else {
          handleAdd();
        }
      } else if (e.key === "Escape") {
        setOpen(false);
        setInputValue("");
        setSelectedIndex(-1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      }
    },
    [handleAdd, handleSelectSuggestion, suggestions, selectedIndex, setOpen]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-suggestion-item]');
      const selectedItem = items[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setInputValue("");
      setSelectedIndex(-1);
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
        className="w-72 p-3"
      >
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="h-9 pl-8 text-sm bg-neutral-50 border-neutral-200 focus:border-neutral-400 focus:ring-1 focus:ring-neutral-300"
            />
          </div>

          {/* Suggestions List */}
          {showSuggestions && (
            <div
              ref={listRef}
              className="max-h-[180px] overflow-y-auto border border-neutral-200 rounded-md bg-white"
            >
              <div className="py-1">
                {!inputValue && (
                  <div className="px-2 py-1 text-[10px] font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Recent
                  </div>
                )}
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    type="button"
                    data-suggestion-item
                    onClick={() => handleSelectSuggestion(suggestion)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-sm transition-colors",
                      selectedIndex === index
                        ? "bg-neutral-100 text-neutral-900"
                        : "text-neutral-700 hover:bg-neutral-50"
                    )}
                  >
                    {inputValue ? (
                      <HighlightMatch text={suggestion} query={inputValue} />
                    ) : (
                      suggestion
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 rounded border border-neutral-200 hover:border-neutral-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleAdd()}
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

// Helper component to highlight matching text
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, index)}
      <span className="font-semibold text-neutral-900">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  );
}
