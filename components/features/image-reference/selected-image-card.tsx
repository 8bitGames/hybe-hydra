"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, X, Lightbulb } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface SelectedImageCardProps {
  imageUrl: string;
  filename: string;
  description: string;
  onDescriptionChange: (description: string) => void;
  onChangeImage: () => void;
  onRemove: () => void;
}

export function SelectedImageCard({
  imageUrl,
  filename,
  description,
  onDescriptionChange,
  onChangeImage,
  onRemove,
}: SelectedImageCardProps) {
  const { t } = useI18n();

  const DESCRIPTION_SUGGESTIONS = [
    t.generation.suggestion1,
    t.generation.suggestion2,
    t.generation.suggestion3,
    t.generation.suggestion4,
    t.generation.suggestion5,
  ];

  const handleSuggestionClick = (suggestion: string) => {
    onDescriptionChange(suggestion);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
      {/* Image Preview */}
      <div className="flex gap-4 p-4">
        <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-border">
          <img
            src={imageUrl}
            alt={filename}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate mb-1">{filename}</p>
          <p className="text-xs text-muted-foreground mb-3">
            {t.generation.imageUsageDescription}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onChangeImage}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              {t.generation.changeImage}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="w-3 h-3 mr-1" />
              {t.common.remove}
            </Button>
          </div>
        </div>
      </div>

      {/* Description Input */}
      <div className="px-4 pb-4 space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            {t.generation.imageUsageRequired} <span className="text-destructive">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={t.generation.imageUsagePlaceholder}
            rows={3}
            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
          />
        </div>

        {/* Quick Suggestions */}
        {!description && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              {t.generation.quickSelect}:
            </p>
            <div className="flex flex-wrap gap-2">
              {DESCRIPTION_SUGGESTIONS.slice(0, 3).map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-2 py-1 text-xs bg-background border border-border rounded-md hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                >
                  {suggestion.length > 30
                    ? suggestion.slice(0, 30) + "..."
                    : suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Character Count */}
        <div className="flex justify-end">
          <span
            className={`text-xs ${
              description.length > 200
                ? "text-amber-500"
                : "text-muted-foreground"
            }`}
          >
            {description.length}/200
          </span>
        </div>
      </div>
    </div>
  );
}
