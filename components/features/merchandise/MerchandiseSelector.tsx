"use client";

import { useState, useEffect, useCallback } from "react";
import {
  merchandiseApi,
  MerchandiseItem,
  MerchandiseSuggestionCategory,
  MerchandiseContext,
  MerchandiseReference,
  getMerchandiseTypeIcon,
  getContextIcon,
  MERCHANDISE_CONTEXTS,
  MERCHANDISE_TYPES,
  MerchandiseType,
} from "@/lib/merchandise-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, ChevronDown, ChevronUp, Search, X, Check } from "lucide-react";

interface SelectedMerchandise extends MerchandiseItem {
  context: MerchandiseContext;
  guidance_scale: number;
}

interface MerchandiseSelectorProps {
  campaignId: string;
  artistId?: string;
  selectedItems: MerchandiseReference[];
  onSelectionChange: (items: MerchandiseReference[]) => void;
  maxItems?: number;
}

const CATEGORY_LABELS: Record<string, { label: string; labelKo: string; icon: string }> = {
  artist_merchandise: { label: "Artist Merchandise", labelKo: "아티스트 굿즈", icon: "🎤" },
  recently_used: { label: "Recently Used", labelKo: "최근 사용", icon: "🕐" },
  popular: { label: "Popular", labelKo: "인기 굿즈", icon: "🔥" },
  new_releases: { label: "New Releases", labelKo: "신규 굿즈", icon: "✨" },
};

export default function MerchandiseSelector({
  campaignId,
  artistId,
  selectedItems,
  onSelectionChange,
  maxItems = 3,
}: MerchandiseSelectorProps) {
  const [suggestions, setSuggestions] = useState<MerchandiseSuggestionCategory[]>([]);
  const [allMerchandise, setAllMerchandise] = useState<MerchandiseItem[]>([]);
  const [selectedMerchandise, setSelectedMerchandise] = useState<Map<string, SelectedMerchandise>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<MerchandiseType | "all">("all");
  const [showAllItems, setShowAllItems] = useState(false);
  const [editingContextId, setEditingContextId] = useState<string | null>(null);

  // Load suggestions and merchandise
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [suggestionsResult, allResult] = await Promise.all([
        merchandiseApi.getSuggestions({
          campaign_id: campaignId,
          artist_id: artistId,
          limit: 10,
        }),
        merchandiseApi.getAll({ page_size: 50, active_only: true }),
      ]);

      if (suggestionsResult.data) {
        setSuggestions(suggestionsResult.data.suggestions);
      }
      if (allResult.data) {
        setAllMerchandise(allResult.data.items);
      }
    } catch (err) {
      console.error("Failed to load merchandise:", err);
    } finally {
      setLoading(false);
    }
  }, [campaignId, artistId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync selected items with parent
  useEffect(() => {
    const newMap = new Map<string, SelectedMerchandise>();
    selectedItems.forEach((item) => {
      const merchandise = allMerchandise.find((m) => m.id === item.merchandise_id);
      if (merchandise) {
        newMap.set(item.merchandise_id, {
          ...merchandise,
          context: item.context,
          guidance_scale: item.guidance_scale || 0.7,
        });
      }
    });
    setSelectedMerchandise(newMap);
  }, [selectedItems, allMerchandise]);

  // Handle item selection
  const handleSelect = (item: MerchandiseItem) => {
    const newSelected = new Map(selectedMerchandise);

    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else {
      if (newSelected.size >= maxItems) {
        return; // Max items reached
      }
      // Determine default context based on type
      let defaultContext: MerchandiseContext = "holding";
      if (item.type === "apparel") {
        defaultContext = "wearing";
      } else if (item.type === "lightstick") {
        defaultContext = "holding";
      }

      newSelected.set(item.id, {
        ...item,
        context: defaultContext,
        guidance_scale: 0.7,
      });
    }

    setSelectedMerchandise(newSelected);
    updateParent(newSelected);
  };

  // Handle context change
  const handleContextChange = (itemId: string, context: MerchandiseContext) => {
    const newSelected = new Map(selectedMerchandise);
    const item = newSelected.get(itemId);
    if (item) {
      newSelected.set(itemId, { ...item, context });
      setSelectedMerchandise(newSelected);
      updateParent(newSelected);
    }
    setEditingContextId(null);
  };

  // Handle guidance scale change
  const handleGuidanceChange = (itemId: string, guidance_scale: number) => {
    const newSelected = new Map(selectedMerchandise);
    const item = newSelected.get(itemId);
    if (item) {
      newSelected.set(itemId, { ...item, guidance_scale });
      setSelectedMerchandise(newSelected);
      updateParent(newSelected);
    }
  };

  // Update parent component
  const updateParent = (selected: Map<string, SelectedMerchandise>) => {
    const references: MerchandiseReference[] = Array.from(selected.values()).map((item) => ({
      merchandise_id: item.id,
      context: item.context,
      guidance_scale: item.guidance_scale,
    }));
    onSelectionChange(references);
  };

  // Filter merchandise
  const filteredMerchandise = allMerchandise.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.name_ko?.toLowerCase().includes(query) ||
        item.artist?.name.toLowerCase().includes(query) ||
        item.artist?.stage_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Spinner className="h-5 w-5" />
            <span className="text-muted-foreground">Loading merchandise...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedArray = Array.from(selectedMerchandise.values());

  return (
    <Card>
      {/* Header */}
      <CardHeader className="p-4 pb-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between hover:bg-muted/50 rounded-lg transition-colors -mx-2 px-2 py-1"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <CardTitle className="text-base flex items-center gap-2">
                Merchandise Reference
                {selectedArray.length > 0 && (
                  <Badge variant="secondary">
                    {selectedArray.length}/{maxItems}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                Select merchandise to include in your AI-generated video
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="p-4 pt-4">
          {/* Selected Items */}
          {selectedArray.length > 0 && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Selected Merchandise:</p>
              <div className="space-y-2">
                {selectedArray.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 bg-primary/5 border border-primary/20 rounded-lg"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                      {item.thumbnail_url || item.s3_url ? (
                        <img
                          src={item.thumbnail_url || item.s3_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          {getMerchandiseTypeIcon(item.type)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-medium truncate">
                        {item.name_ko || item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {/* Context Selector */}
                        {editingContextId === item.id ? (
                          <select
                            value={item.context}
                            onChange={(e) => handleContextChange(item.id, e.target.value as MerchandiseContext)}
                            onBlur={() => setEditingContextId(null)}
                            autoFocus
                            className="text-xs bg-background border border-border rounded px-2 py-0.5 text-foreground"
                          >
                            {MERCHANDISE_CONTEXTS.map((ctx) => (
                              <option key={ctx.value} value={ctx.value}>
                                {ctx.labelKo} ({ctx.label})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingContextId(item.id)}
                            className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded hover:bg-muted/80 transition-colors flex items-center gap-1"
                          >
                            {getContextIcon(item.context)}
                            {MERCHANDISE_CONTEXTS.find((c) => c.value === item.context)?.labelKo}
                          </button>
                        )}

                        {/* Guidance Scale */}
                        <div className="flex items-center gap-1">
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={item.guidance_scale}
                            onChange={(e) => handleGuidanceChange(item.id, parseFloat(e.target.value))}
                            className="w-16 h-1 accent-primary"
                          />
                          <span className="text-xs text-muted-foreground">{(item.guidance_scale * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <Button
                      onClick={() => handleSelect(item)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search and Filter */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search merchandise..."
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as MerchandiseType | "all")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {MERCHANDISE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.labelKo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowAllItems(!showAllItems)}
              variant={showAllItems ? "default" : "outline"}
              size="sm"
            >
              {showAllItems ? "Show Suggestions" : "Show All"}
            </Button>
          </div>

          {/* Suggestions or All Items */}
          {showAllItems ? (
            // All Items Grid
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {filteredMerchandise.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No merchandise found
                </div>
              ) : (
                filteredMerchandise.map((item) => (
                  <MerchandiseCard
                    key={item.id}
                    item={item}
                    isSelected={selectedMerchandise.has(item.id)}
                    onSelect={() => handleSelect(item)}
                    disabled={!selectedMerchandise.has(item.id) && selectedMerchandise.size >= maxItems}
                  />
                ))
              )}
            </div>
          ) : (
            // Suggestions by Category
            <div className="space-y-4 max-h-72 overflow-y-auto">
              {suggestions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No suggestions available</p>
                  <button
                    onClick={() => setShowAllItems(true)}
                    className="mt-2 text-primary hover:text-primary/80 text-sm"
                  >
                    Browse all merchandise
                  </button>
                </div>
              ) : (
                suggestions.map((category) => (
                  <div key={category.category}>
                    <div className="flex items-center gap-2 mb-2">
                      <span>{CATEGORY_LABELS[category.category]?.icon || "📦"}</span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {CATEGORY_LABELS[category.category]?.labelKo || category.category}
                      </span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {category.items.map((item) => (
                        <MerchandiseCard
                          key={item.id}
                          item={item}
                          isSelected={selectedMerchandise.has(item.id)}
                          onSelect={() => handleSelect(item)}
                          disabled={!selectedMerchandise.has(item.id) && selectedMerchandise.size >= maxItems}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Help Text */}
          <p className="text-xs text-muted-foreground mt-4">
            {selectedArray.length === 0
              ? "Select merchandise to include in your video generation"
              : `${selectedArray.length} item(s) selected. AI will generate video featuring the selected merchandise.`}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// Merchandise Card Component
function MerchandiseCard({
  item,
  isSelected,
  onSelect,
  disabled,
  compact = false,
}: {
  item: MerchandiseItem;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`${
        compact ? "w-28 flex-shrink-0" : ""
      } group relative rounded-lg border-2 overflow-hidden transition-all ${
        isSelected
          ? "border-primary bg-primary/5"
          : disabled
          ? "border-border opacity-50 cursor-not-allowed"
          : "border-border hover:border-muted-foreground hover:bg-muted/50"
      }`}
    >
      {/* Image */}
      <div className="aspect-square bg-muted relative">
        {item.thumbnail_url || item.s3_url ? (
          <img
            src={item.thumbnail_url || item.s3_url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            {getMerchandiseTypeIcon(item.type)}
          </div>
        )}

        {/* Selection Indicator */}
        {isSelected && (
          <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-background/80 backdrop-blur-sm rounded text-xs text-foreground">
          {getMerchandiseTypeIcon(item.type)}
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-foreground text-xs font-medium truncate">
          {item.name_ko || item.name}
        </p>
        {item.artist && (
          <p className="text-muted-foreground text-xs truncate">
            {item.artist.stage_name || item.artist.name}
          </p>
        )}
      </div>
    </button>
  );
}
