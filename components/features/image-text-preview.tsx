"use client";

import { Badge } from "@/components/ui/badge";
import { ImageCandidate } from "@/lib/compose-api";

interface ScriptLine {
  text: string;
  timing: number;
  duration: number;
}

interface ImageTextPreviewProps {
  images: ImageCandidate[];
  scriptLines: ScriptLine[];
  totalDuration: number;
}

export function ImageTextPreview({
  images,
  scriptLines,
  totalDuration
}: ImageTextPreviewProps) {
  if (images.length === 0) {
    return null;
  }

  // Calculate effective duration - if 0, derive from script lines
  let effectiveDuration = totalDuration;
  if (effectiveDuration <= 0 && scriptLines.length > 0) {
    const lastLine = scriptLines[scriptLines.length - 1];
    effectiveDuration = lastLine.timing + lastLine.duration;
  }
  // Fallback to 15 seconds if still 0
  if (effectiveDuration <= 0) {
    effectiveDuration = 15;
  }

  // Calculate which text lines appear with which images
  // Each image gets roughly equal screen time
  const imageDuration = effectiveDuration / images.length;

  // Map each image to its corresponding script lines
  const imageTextMappings = images.map((image, imageIndex) => {
    const imageStart = imageIndex * imageDuration;
    const imageEnd = (imageIndex + 1) * imageDuration;

    // Find all script lines that overlap with this image's display time
    const overlappingLines = scriptLines.filter((line) => {
      const lineEnd = line.timing + line.duration;
      // Check if line overlaps with image time
      return line.timing < imageEnd && lineEnd > imageStart;
    });

    return {
      image,
      imageIndex,
      lines: overlappingLines,
      timeRange: { start: imageStart, end: imageEnd }
    };
  });

  // Color palette matching script-timeline.tsx
  const lineColors = [
    "bg-yellow-500", // Hook
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-cyan-500",
    "bg-red-500",
  ];

  const getLineColor = (lineIndex: number) => {
    return lineColors[lineIndex % lineColors.length];
  };

  const getLineLabel = (lineIndex: number, totalLines: number) => {
    if (lineIndex === 0) return "Hook";
    if (lineIndex === totalLines - 1) return "CTA";
    return `Line ${lineIndex + 1}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <span>🎬</span> 이미지-텍스트 매칭 프리뷰
        </h4>
        <Badge variant="outline" className="text-xs">
          {images.length}개 이미지 × {scriptLines.length}개 자막
        </Badge>
      </div>

      {/* Preview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {imageTextMappings.map(({ image, imageIndex, lines, timeRange }) => (
          <div
            key={image.id}
            className="relative rounded-lg overflow-hidden border border-border bg-muted/30"
          >
            {/* Image */}
            <div className="aspect-[9/16] relative">
              <img
                src={image.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
              />

              {/* Order badge */}
              <div className="absolute top-2 left-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground">
                {imageIndex + 1}
              </div>

              {/* Time range */}
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 rounded text-[10px] text-white">
                {timeRange.start.toFixed(1)}s - {timeRange.end.toFixed(1)}s
              </div>

              {/* Text overlays simulation */}
              <div className="absolute bottom-0 left-0 right-0 p-2 space-y-1">
                {lines.length > 0 ? (
                  lines.map((line, idx) => {
                    const globalLineIndex = scriptLines.findIndex(
                      (l) => l.text === line.text && l.timing === line.timing
                    );
                    return (
                      <div
                        key={idx}
                        className="relative"
                      >
                        {/* Text preview with matching color indicator */}
                        <div className="flex items-start gap-1">
                          <div
                            className={`w-1.5 h-full min-h-[16px] rounded-full ${getLineColor(globalLineIndex)} shrink-0`}
                          />
                          <div className="bg-black/80 px-2 py-1 rounded text-white text-xs leading-tight max-w-full">
                            <span className="line-clamp-2">{line.text}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-black/50 px-2 py-1 rounded text-gray-400 text-xs text-center">
                    (텍스트 없음)
                  </div>
                )}
              </div>
            </div>

            {/* Info footer */}
            <div className="p-2 border-t border-border">
              <div className="flex flex-wrap gap-1">
                {lines.map((line, idx) => {
                  const globalLineIndex = scriptLines.findIndex(
                    (l) => l.text === line.text && l.timing === line.timing
                  );
                  return (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className={`text-[10px] ${getLineColor(globalLineIndex)} text-white`}
                    >
                      {getLineLabel(globalLineIndex, scriptLines.length)}
                    </Badge>
                  );
                })}
                {lines.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    배경 이미지
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2 border-t">
        {scriptLines.map((line, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs">
            <div className={`w-3 h-3 rounded ${getLineColor(idx)}`} />
            <span className="text-muted-foreground">
              {getLineLabel(idx, scriptLines.length)}:
            </span>
            <span className="truncate max-w-[120px]" title={line.text}>
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
