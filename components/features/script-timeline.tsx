"use client";

import { Badge } from "@/components/ui/badge";

interface ScriptLine {
  text: string;
  timing: number;
  duration: number;
}

interface ScriptTimelineProps {
  lines: ScriptLine[];
  totalDuration: number;
  showHookIndicator?: boolean;
}

export function ScriptTimeline({
  lines,
  totalDuration,
  showHookIndicator = true
}: ScriptTimelineProps) {
  // Calculate the max time for the timeline
  const maxTime = Math.max(
    totalDuration,
    ...lines.map(l => l.timing + l.duration)
  );

  // Round up to nearest 5 seconds for cleaner display
  const displayMax = Math.ceil(maxTime / 5) * 5;

  // Generate time markers
  const timeMarkers = [];
  for (let t = 0; t <= displayMax; t += 5) {
    timeMarkers.push(t);
  }

  // Hook duration (first 2 seconds)
  const hookDuration = 2;

  // Color palette for different lines
  const lineColors = [
    "bg-yellow-500", // Hook - yellow
    "bg-blue-500",   // Setup
    "bg-green-500",  // Build
    "bg-purple-500", // Climax
    "bg-pink-500",   // Peak
    "bg-orange-500", // CTA
    "bg-cyan-500",   // Extra
    "bg-red-500",    // Extra
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <span>📝</span> 텍스트 타임라인
        </h4>
        <Badge variant="outline" className="text-xs">
          총 {lines.length}개 자막
        </Badge>
      </div>

      {/* Timeline Container */}
      <div className="relative bg-muted/50 rounded-lg p-3">
        {/* Time Axis */}
        <div className="flex justify-between text-xs text-muted-foreground mb-2 px-1">
          {timeMarkers.map(t => (
            <span key={t} className="w-8 text-center">{t}s</span>
          ))}
        </div>

        {/* Timeline Track */}
        <div className="relative h-20 bg-muted rounded overflow-hidden">
          {/* Hook Section Indicator (0-2 seconds) */}
          {showHookIndicator && (
            <div
              className="absolute top-0 h-full bg-yellow-500/20 border-r-2 border-yellow-500 z-0"
              style={{
                left: 0,
                width: `${(hookDuration / displayMax) * 100}%`
              }}
            >
              <span className="absolute top-1 left-1 text-[10px] text-yellow-600 font-medium">
                Hook
              </span>
            </div>
          )}

          {/* Beat Drop indicator (after 2 seconds) */}
          <div
            className="absolute top-0 h-full z-0"
            style={{
              left: `${(hookDuration / displayMax) * 100}%`,
              width: `${((displayMax - hookDuration) / displayMax) * 100}%`
            }}
          >
            <span className="absolute top-1 left-1 text-[10px] text-muted-foreground">
              Beat Drop
            </span>
          </div>

          {/* Script Line Blocks */}
          {lines.map((line, idx) => {
            const left = (line.timing / displayMax) * 100;
            const width = (line.duration / displayMax) * 100;
            const color = lineColors[idx % lineColors.length];

            return (
              <div
                key={idx}
                className={`absolute h-10 bottom-2 ${color} rounded shadow-sm flex items-center justify-center overflow-hidden cursor-pointer transition-all hover:scale-105 hover:z-20`}
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 3)}%`,
                  minWidth: '30px'
                }}
                title={`${line.text} (${line.timing}s - ${(line.timing + line.duration).toFixed(1)}s)`}
              >
                <span className="text-white text-xs font-medium px-1 truncate">
                  {line.text.length > 12 ? `${line.text.slice(0, 12)}...` : line.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-3">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1 text-xs"
            >
              <div className={`w-3 h-3 rounded ${lineColors[idx % lineColors.length]}`} />
              <span className="text-muted-foreground">
                {idx === 0 ? 'Hook' : idx === lines.length - 1 ? 'CTA' : `Line ${idx + 1}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Line Details */}
      <div className="space-y-1.5">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm"
          >
            <div className={`w-2 h-2 rounded-full ${lineColors[idx % lineColors.length]}`} />
            <span className="text-muted-foreground w-14 text-xs">
              {line.timing.toFixed(1)}s
            </span>
            <span className="flex-1 truncate">{line.text}</span>
            <span className="text-muted-foreground text-xs">
              {line.duration.toFixed(1)}s
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
