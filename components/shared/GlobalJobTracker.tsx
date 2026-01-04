"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAuthStore } from "@/lib/auth-store";
import {
  useJobStore,
  JOB_TYPE_LABELS,
  JOB_STATUS_LABELS,
  type Job,
  type JobStatus,
} from "@/lib/stores/job-store";
import { ProgressIndicator } from "./ProgressIndicator";

interface GlobalJobTrackerProps {
  className?: string;
}

/**
 * Global job tracker that shows in the header
 * 헤더에 표시되는 글로벌 작업 트래커
 */
export function GlobalJobTracker({ className }: GlobalJobTrackerProps) {
  const { language } = useI18n();
  const { jobTrackerExpanded, toggleJobTracker } = useUIStore();
  const { isAuthenticated } = useAuthStore();
  const jobs = useJobStore((state) => state.jobs);
  const recentJobs = useJobStore((state) => state.recentJobs);
  const [isCancelling, setIsCancelling] = useState(false);
  const router = useRouter();

  // Compute derived values with useMemo to avoid infinite loops
  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === "QUEUED" || job.status === "PROCESSING"),
    [jobs]
  );

  const counts = useMemo(
    () => ({
      queued: jobs.filter((j) => j.status === "QUEUED").length,
      processing: jobs.filter((j) => j.status === "PROCESSING").length,
      completed: jobs.filter((j) => j.status === "COMPLETED").length,
    }),
    [jobs]
  );

  // Poll for job updates only when authenticated
  useEffect(() => {
    // Check authentication - cookies handle the actual auth
    if (!isAuthenticated) {
      return;
    }

    let isPollingActive = true;
    let consecutiveFailures = 0;
    const MAX_FAILURES = 3;

    const fetchJobs = async () => {
      // Double-check auth state before each request
      if (!isPollingActive || !useAuthStore.getState().isAuthenticated) {
        return;
      }

      try {
        // Use cookie-based authentication (credentials: 'include')
        const response = await fetch("/api/v1/jobs", {
          credentials: "include",
        });

        if (response.status === 401 || response.status === 403) {
          // Auth failed - stop polling to prevent spam
          console.warn("[GlobalJobTracker] Auth failed, stopping poll");
          isPollingActive = false;
          return;
        }

        if (response.ok) {
          consecutiveFailures = 0; // Reset on success
          const data = await response.json();
          useJobStore.getState().setJobs(data.active || []);
          useJobStore.getState().setRecentJobs(data.recent || []);
        } else {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_FAILURES) {
            console.warn("[GlobalJobTracker] Too many failures, stopping poll");
            isPollingActive = false;
          }
        }
      } catch {
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_FAILURES) {
          isPollingActive = false;
        }
      }
    };

    // Initial fetch
    fetchJobs();

    // Poll every 5 seconds (reduced from 2s to minimize requests)
    const interval = setInterval(fetchJobs, 5000);

    return () => {
      isPollingActive = false;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const hasActiveJobs = activeJobs.length > 0;
  const totalActive = counts.processing + counts.queued;

  // Cancel all active jobs
  const handleCancelAll = async () => {
    if (isCancelling) return;

    setIsCancelling(true);
    try {
      // Use cookie-based authentication
      const response = await fetch("/api/v1/jobs/cancel-all", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        // Clear jobs from store immediately
        useJobStore.getState().setJobs([]);
      }
    } catch {
      // Silent fail
    } finally {
      setIsCancelling(false);
    }
  };

  // Navigate to specific job's page based on job type
  const handleNavigateToJob = (job: Job) => {
    // For VIDEO_GENERATION jobs with a campaign, go to the campaign generate page
    if (job.type === "VIDEO_GENERATION" && job.campaignId) {
      router.push(`/campaigns/${job.campaignId}/generate`);
      toggleJobTracker();
      return;
    }

    // For VIDEO_COMPOSE (Fast Cut) jobs, go to create page
    if (job.type === "VIDEO_COMPOSE") {
      router.push("/create");
      toggleJobTracker();
      return;
    }

    // For other job types with campaignId, go to campaign page
    if (job.campaignId) {
      router.push(`/campaigns/${job.campaignId}`);
      toggleJobTracker();
      return;
    }

    // For jobs without campaign (quick create), go to create page
    router.push("/create");
    toggleJobTracker();
  };

  return (
    <div className={cn("relative flex items-center gap-1", className)}>
      {/* Trigger button - opens dropdown to show job list */}
      <Button
        variant={hasActiveJobs ? "default" : "ghost"}
        size="sm"
        className={cn("gap-2 relative", hasActiveJobs && "animate-pulse")}
        onClick={toggleJobTracker}
      >
        {hasActiveJobs ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="hidden sm:inline">
              {totalActive} {language === "ko" ? "작업 진행 중" : "tasks running"}
            </span>
            <span className="sm:hidden">{totalActive}</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="hidden sm:inline">
              {language === "ko" ? "모든 작업 완료" : "All tasks complete"}
            </span>
          </>
        )}
        {jobTrackerExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </Button>

      {/* Expanded panel */}
      {jobTrackerExpanded && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-popover border rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">
              {language === "ko" ? "작업 상태" : "Task Status"}
            </h3>
            <div className="flex items-center gap-1">
              {hasActiveJobs && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleCancelAll}
                  disabled={isCancelling}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  {language === "ko" ? "모두 취소" : "Cancel All"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={toggleJobTracker}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Job list */}
          <ScrollArea className="max-h-96">
            <div className="p-2 space-y-2">
              {/* Active jobs */}
              {activeJobs.length > 0 ? (
                activeJobs.map((job) => (
                  <JobItem
                    key={job.id}
                    job={job}
                    language={language}
                    onNavigate={() => handleNavigateToJob(job)}
                  />
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  {language === "ko"
                    ? "진행 중인 작업이 없습니다"
                    : "No active tasks"}
                </div>
              )}

              {/* Recent completed/failed jobs */}
              {recentJobs.length > 0 && (
                <>
                  <div className="px-2 py-1 mt-2">
                    <span className="text-xs text-muted-foreground uppercase">
                      {language === "ko" ? "최근 완료" : "Recently Completed"}
                    </span>
                  </div>
                  {recentJobs.slice(0, 5).map((job) => (
                    <JobItem
                      key={job.id}
                      job={job}
                      language={language}
                      compact
                    />
                  ))}
                </>
              )}
            </div>
          </ScrollArea>

          {/* Footer with counts */}
          <div className="border-t bg-muted/50">
            {/* Counts */}
            <div className="px-4 py-2 text-xs text-muted-foreground flex justify-between">
              <span>
                {language === "ko" ? "처리중" : "Processing"}: {counts.processing}
              </span>
              <span>
                {language === "ko" ? "대기중" : "Queued"}: {counts.queued}
              </span>
              <span>
                {language === "ko" ? "완료" : "Completed"}: {counts.completed}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface JobItemProps {
  job: Job;
  language: "ko" | "en";
  compact?: boolean;
  onNavigate?: () => void;
}

function JobItem({ job, language, compact, onNavigate }: JobItemProps) {
  const statusIcon = getStatusIcon(job.status);
  const statusColor = getStatusColor(job.status);
  const typeLabel = JOB_TYPE_LABELS[job.type];

  const isActive = job.status === "QUEUED" || job.status === "PROCESSING";

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50">
        <span className={statusColor}>{statusIcon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">
            {language === "ko" ? typeLabel.ko : typeLabel.en}
          </p>
        </div>
        {job.result?.outputUrl && (
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Eye className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "px-3 py-3 rounded-lg bg-accent/30 space-y-2",
        isActive && onNavigate && "cursor-pointer hover:bg-accent/50 transition-colors"
      )}
      onClick={isActive && onNavigate ? onNavigate : undefined}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5", statusColor)}>{statusIcon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {language === "ko" ? job.title.ko : job.title.en}
          </p>
          {job.campaignName && (
            <p className="text-xs text-muted-foreground truncate">
              {job.campaignName}
            </p>
          )}
        </div>
        <Badge variant="outline" className="text-[10px]">
          {language === "ko"
            ? JOB_STATUS_LABELS[job.status].ko
            : JOB_STATUS_LABELS[job.status].en}
        </Badge>
      </div>

      {/* Progress bar */}
      {(job.status === "PROCESSING" || job.status === "QUEUED") && (
        <ProgressIndicator
          progress={job.progress}
          status={job.status === "PROCESSING" ? "processing" : "pending"}
          estimatedTime={
            job.estimatedDuration
              ? formatDuration(job.estimatedDuration, language)
              : undefined
          }
          size="sm"
        />
      )}

      {/* Current step */}
      {job.currentStep && job.status === "PROCESSING" && (
        <p className="text-xs text-muted-foreground">
          {language === "ko" ? job.currentStep.ko : job.currentStep.en}
        </p>
      )}

      {/* Actions for completed jobs */}
      {job.status === "COMPLETED" && job.result?.outputUrl && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Eye className="h-3 w-3 mr-1" />
            {language === "ko" ? "보기" : "View"}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Send className="h-3 w-3 mr-1" />
            {language === "ko" ? "발행" : "Publish"}
          </Button>
        </div>
      )}

      {/* Error message for failed jobs */}
      {job.status === "FAILED" && job.result?.error && (
        <p className="text-xs text-destructive">{job.result.error}</p>
      )}
    </div>
  );
}

function getStatusIcon(status: JobStatus) {
  switch (status) {
    case "QUEUED":
      return <Clock className="h-4 w-4" />;
    case "PROCESSING":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "COMPLETED":
      return <CheckCircle2 className="h-4 w-4" />;
    case "FAILED":
      return <XCircle className="h-4 w-4" />;
    case "CANCELLED":
      return <X className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function getStatusColor(status: JobStatus) {
  switch (status) {
    case "QUEUED":
      return "text-muted-foreground";
    case "PROCESSING":
      return "text-blue-500";
    case "COMPLETED":
      return "text-green-500";
    case "FAILED":
      return "text-destructive";
    case "CANCELLED":
      return "text-yellow-500";
    default:
      return "text-muted-foreground";
  }
}

function formatDuration(seconds: number, language: "ko" | "en"): string {
  if (seconds < 60) {
    return language === "ko" ? `${seconds}초` : `${seconds}s`;
  }
  const minutes = Math.ceil(seconds / 60);
  return language === "ko" ? `${minutes}분` : `${minutes}min`;
}
