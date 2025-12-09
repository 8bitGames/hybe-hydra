"use client";

import { Badge } from "@/components/ui/badge";
import { AudioMatch, ScriptLine } from "@/lib/fast-cut-api";

interface AudioStructurePreviewProps {
  audio: AudioMatch;
  scriptLines?: ScriptLine[];
  totalDuration: number;
  // Real analysis data from compose-engine
  realEnergyCurve?: [number, number][];  // [[time, energy], ...]
  realBeatTimes?: number[];
  isAnalyzed?: boolean;
}

// TikTok Hook Strategy Constants
const HOOK_DURATION = 2.0; // First 2 seconds for calm hook
const BEAT_DROP_TIME = 2.0; // Beat drops at 2 seconds

export function AudioStructurePreview({
  audio,
  scriptLines = [],
  totalDuration,
  realEnergyCurve,
  realBeatTimes,
  isAnalyzed = false
}: AudioStructurePreviewProps) {
  // Check if we have real analysis data (from props or audio object)
  const hasRealData = isAnalyzed || audio.analyzed || (realEnergyCurve && realEnergyCurve.length > 0);
  // Calculate the display duration (use totalDuration or audio duration, whichever is smaller)
  const displayDuration = Math.min(audio.duration, totalDuration);

  // Round up to nearest 5 seconds for cleaner display
  const displayMax = Math.ceil(displayDuration / 5) * 5;

  // Generate time markers
  const timeMarkers = [];
  for (let t = 0; t <= displayMax; t += 5) {
    timeMarkers.push(t);
  }

  // Use real energy curve from compose-engine if available, otherwise simulate
  const getEnergyCurve = (): { time: number; energy: number }[] => {
    // Priority: props > audio object > simulated
    const curveData = realEnergyCurve || audio.energyCurve;

    if (curveData && curveData.length > 0) {
      // Use real data from librosa analysis
      return curveData
        .filter(([time]) => time <= displayDuration)
        .map(([time, energy]) => ({ time, energy }));
    }

    // Fallback: Simulate energy curve based on BPM and energy
    // Higher BPM = more beats, higher energy = higher amplitude
    const points: { time: number; energy: number }[] = [];
    const bpm = audio.bpm || 100;
    const baseEnergy = audio.energy || 0.5;

    for (let t = 0; t <= displayDuration; t += 0.5) {
      let energy: number;

      if (t < HOOK_DURATION) {
        // Hook section: calm, building energy
        energy = 0.3 + (t / HOOK_DURATION) * 0.2;
      } else {
        // After beat drop: varying energy based on BPM
        const beatPhase = ((t - HOOK_DURATION) * bpm / 60) % 1;
        const beatPulse = Math.sin(beatPhase * Math.PI * 2) * 0.3;

        // Add some natural variation
        const variation = Math.sin(t * 0.5) * 0.1;

        // Energy peaks around middle, decreases toward end
        const envelopePosition = (t - HOOK_DURATION) / (displayDuration - HOOK_DURATION);
        const envelope = Math.sin(envelopePosition * Math.PI) * 0.2 + 0.7;

        energy = (baseEnergy * envelope) + beatPulse + variation;
        energy = Math.max(0.2, Math.min(1, energy));
      }

      points.push({ time: t, energy });
    }

    return points;
  };

  const energyCurve = getEnergyCurve();

  // Calculate where climax might be (highest energy section)
  const findClimaxSection = () => {
    if (energyCurve.length === 0) return null;

    // Find the point with highest energy after the hook
    const postHookCurve = energyCurve.filter(p => p.time >= HOOK_DURATION);
    if (postHookCurve.length === 0) return null;

    const maxEnergy = Math.max(...postHookCurve.map(p => p.energy));
    const climaxPoint = postHookCurve.find(p => p.energy === maxEnergy);

    if (!climaxPoint) return null;

    // Climax section is around the peak
    return {
      start: Math.max(HOOK_DURATION, climaxPoint.time - 2),
      end: Math.min(displayDuration, climaxPoint.time + 2)
    };
  };

  const climaxSection = findClimaxSection();

  // Color palette for script lines
  const lineColors = [
    "bg-yellow-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-cyan-500",
    "bg-red-500",
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <span>🎵</span> 음악 구조 분석
          {hasRealData ? (
            <Badge variant="default" className="text-[10px] bg-green-600 hover:bg-green-700">
              AI 분석
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              추정값
            </Badge>
          )}
        </h4>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">
            {audio.bpm ? `${audio.bpm} BPM` : '~100 BPM (추정)'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {audio.duration.toFixed(0)}초
          </Badge>
          {audio.vibe && (
            <Badge variant="secondary" className="text-xs">
              {audio.vibe}
            </Badge>
          )}
        </div>
      </div>

      {/* Main Structure Visualization */}
      <div className="relative bg-muted/50 rounded-lg p-3">
        {/* Time Axis */}
        <div className="flex justify-between text-xs text-muted-foreground mb-2 px-1">
          {timeMarkers.map(t => (
            <span key={t} className="w-8 text-center">{t}s</span>
          ))}
        </div>

        {/* Main Timeline Track */}
        <div className="relative h-32 bg-muted rounded overflow-hidden">
          {/* Hook Section (0-2 seconds) */}
          <div
            className="absolute top-0 h-full bg-yellow-500/20 border-r-2 border-yellow-500 z-10"
            style={{
              left: 0,
              width: `${(HOOK_DURATION / displayMax) * 100}%`
            }}
          >
            <div className="absolute top-1 left-1 right-1">
              <span className="text-[10px] text-yellow-600 font-medium block">
                🔇 Hook Zone
              </span>
              <span className="text-[8px] text-yellow-600/80">
                Calm (70% vol)
              </span>
            </div>
          </div>

          {/* Beat Drop Section */}
          <div
            className="absolute top-0 h-full bg-primary/10 z-0"
            style={{
              left: `${(BEAT_DROP_TIME / displayMax) * 100}%`,
              width: `${((displayMax - BEAT_DROP_TIME) / displayMax) * 100}%`
            }}
          >
            <div className="absolute top-1 left-1">
              <span className="text-[10px] text-primary font-medium block">
                🔊 Beat Drop
              </span>
              <span className="text-[8px] text-primary/80">
                Full Energy
              </span>
            </div>
          </div>

          {/* Climax Section Indicator */}
          {climaxSection && (
            <div
              className="absolute top-0 h-full bg-red-500/20 border-l border-r border-red-500/50 z-5"
              style={{
                left: `${(climaxSection.start / displayMax) * 100}%`,
                width: `${((climaxSection.end - climaxSection.start) / displayMax) * 100}%`
              }}
            >
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                <span className="text-[8px] text-red-500 font-medium bg-background/80 px-1 rounded">
                  🔥 Climax
                </span>
              </div>
            </div>
          )}

          {/* Energy Curve Visualization */}
          <svg
            className="absolute bottom-0 left-0 w-full h-20 z-20"
            preserveAspectRatio="none"
            viewBox={`0 0 ${displayMax} 1`}
          >
            {/* Beat markers (real data from librosa) */}
            {hasRealData && (realBeatTimes || audio.beatTimes)?.filter(t => t <= displayDuration).map((beatTime, idx) => (
              <line
                key={`beat-${idx}`}
                x1={beatTime}
                y1="0"
                x2={beatTime}
                y2="1"
                stroke="currentColor"
                strokeWidth="0.02"
                strokeOpacity="0.3"
                className="text-primary"
              />
            ))}
            {/* Energy area fill */}
            <path
              d={`M 0 1 ${energyCurve.map(p => `L ${p.time} ${1 - p.energy}`).join(' ')} L ${displayDuration} 1 Z`}
              fill="url(#energyGradient)"
              opacity="0.6"
            />
            {/* Energy line */}
            <path
              d={`M ${energyCurve.map(p => `${p.time} ${1 - p.energy}`).join(' L ')}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.05"
              className="text-primary"
            />
            {/* Gradient definition */}
            <defs>
              <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>

          {/* Script Lines Timeline (bottom row) */}
          {scriptLines.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-6 z-30">
              {scriptLines.map((line, idx) => {
                const left = (line.timing / displayMax) * 100;
                const width = (line.duration / displayMax) * 100;
                const color = lineColors[idx % lineColors.length];

                return (
                  <div
                    key={idx}
                    className={`absolute h-5 bottom-0.5 ${color} rounded shadow-sm flex items-center justify-center overflow-hidden cursor-pointer transition-all hover:scale-105 hover:z-40`}
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 3)}%`,
                      minWidth: '30px'
                    }}
                    title={`${line.text} (${line.timing}s - ${(line.timing + line.duration).toFixed(1)}s)`}
                  >
                    <span className="text-white text-[9px] font-medium px-0.5 truncate">
                      {line.text.length > 10 ? `${line.text.slice(0, 10)}...` : line.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500" />
            <span className="text-muted-foreground">Hook (0-2s)</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded bg-primary/20 border border-primary" />
            <span className="text-muted-foreground">Beat Drop</span>
          </div>
          {climaxSection && (
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50" />
              <span className="text-muted-foreground">Climax</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-1 rounded bg-primary" />
            <span className="text-muted-foreground">
              Energy Curve {hasRealData ? '(librosa)' : '(추정)'}
            </span>
          </div>
          {hasRealData && (realBeatTimes || audio.beatTimes)?.length && (
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-0.5 h-3 bg-primary/30" />
              <span className="text-muted-foreground">Beat Markers</span>
            </div>
          )}
        </div>
      </div>

      {/* TikTok Strategy Info */}
      <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-2">
        <h5 className="font-medium flex items-center gap-1">
          <span>📱</span> TikTok Hook 전략
        </h5>
        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-yellow-500">●</span>
            <div>
              <p className="font-medium text-foreground">0-2초: Hook Zone</p>
              <p>볼륨 70%로 차분하게 시작</p>
              <p>호기심 유발 텍스트 표시</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">●</span>
            <div>
              <p className="font-medium text-foreground">2초+: Beat Drop</p>
              <p>볼륨 100%로 임팩트</p>
              <p>메인 콘텐츠 전개</p>
            </div>
          </div>
        </div>
      </div>

      {/* Script-Music Sync Info */}
      {scriptLines.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium flex items-center gap-2">
            <span>📝</span> 자막-음악 동기화
          </h5>
          <div className="grid grid-cols-1 gap-1">
            {scriptLines.map((line, idx) => {
              const color = lineColors[idx % lineColors.length];
              const isInHook = line.timing < HOOK_DURATION;
              const isInClimax = climaxSection &&
                line.timing >= climaxSection.start &&
                line.timing < climaxSection.end;

              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs"
                >
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-muted-foreground w-12">
                    {line.timing.toFixed(1)}s
                  </span>
                  <span className="flex-1 truncate">{line.text}</span>
                  {isInHook && (
                    <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-500">
                      Hook
                    </Badge>
                  )}
                  {isInClimax && (
                    <Badge variant="outline" className="text-[10px] text-red-500 border-red-500">
                      Climax
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
