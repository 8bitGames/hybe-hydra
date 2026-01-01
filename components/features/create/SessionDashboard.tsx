"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  useSessionStore,
  selectInProgressSessions,
  selectCompletedSessions,
  selectPausedSessions,
  type SessionSummary,
  type SessionStatus,
} from "@/lib/stores/session-store";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  Plus,
  Play,
  Pause,
  Trash2,
  MoreVertical,
  Video,
  TrendingUp,
  Lightbulb,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useJobStore } from "@/lib/stores/job-store";
import { SessionDetailModal } from "./SessionDetailModal";

// ============================================================================
// Types
// ============================================================================

interface SessionCardProps {
  session: SessionSummary;
  onResume: (id: string) => void;
  onPause: (id: string) => void;
  onDelete: (id: string, cancelJobs?: boolean) => void;
  isActive?: boolean;
  hasActiveJobs?: boolean;
  isDeleting?: boolean;
}

// ============================================================================
// Session Card Component
// ============================================================================

function SessionCard({
  session,
  onResume,
  onPause,
  onDelete,
  isActive,
  hasActiveJobs,
  isDeleting,
}: SessionCardProps) {
  const { language } = useI18n();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Use different stage lists based on content type
  // AI Video: start → analyze → create → processing → publish (5 stages)
  // Fast Cut: start → images → music → effects → render → publish (6 stages) - Script step removed

  // Infer contentType from currentStage if metadata is missing or inconsistent
  // This handles cases where sessions were created before contentType was properly tracked
  // Note: "script" kept in detection list for backward compatibility with legacy sessions
  const FAST_CUT_ONLY_STAGES = ["script", "images", "music", "effects", "render"];
  const inferredIsFastCut =
    session.metadata.contentType === "fast-cut" ||
    FAST_CUT_ONLY_STAGES.includes(session.currentStage) ||
    session.completedStages?.some(stage => FAST_CUT_ONLY_STAGES.includes(stage));

  const isFastCut = inferredIsFastCut;
  // Script step removed - keywords now come from scene analysis on Start page
  const stages: readonly string[] = isFastCut
    ? ["start", "images", "music", "effects", "render", "publish"]
    : ["start", "analyze", "create", "processing", "publish"];
  const currentStageIndex = stages.indexOf(session.currentStage);

  const statusConfig: Record<
    SessionStatus,
    { label: string; labelKo: string; color: string; icon: React.ReactNode }
  > = {
    draft: {
      label: "Draft",
      labelKo: "초안",
      color: "bg-neutral-100 text-neutral-600",
      icon: <Clock className="h-3 w-3" />,
    },
    in_progress: {
      label: "In Progress",
      labelKo: "진행 중",
      color: "bg-blue-100 text-blue-700",
      icon: <Play className="h-3 w-3" />,
    },
    paused: {
      label: "Paused",
      labelKo: "일시 중지",
      color: "bg-yellow-100 text-yellow-700",
      icon: <Pause className="h-3 w-3" />,
    },
    completed: {
      label: "Completed",
      labelKo: "완료",
      color: "bg-green-100 text-green-700",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    abandoned: {
      label: "Abandoned",
      labelKo: "중단됨",
      color: "bg-red-100 text-red-600",
      icon: <AlertCircle className="h-3 w-3" />,
    },
  };

  const contentTypeConfig: Record<
    string,
    { label: string; labelKo: string; icon: React.ReactNode }
  > = {
    "fast-cut": {
      label: "Fast Cut",
      labelKo: "Fast Cut",
      icon: <Sparkles className="h-3 w-3" />,
    },
    "ai_video": {
      label: "AI Video",
      labelKo: "AI 영상",
      icon: <Video className="h-3 w-3" />,
    },
  };

  const entrySourceConfig: Record<
    string,
    { label: string; labelKo: string; icon: React.ReactNode }
  > = {
    trends: {
      label: "From Trends",
      labelKo: "트렌드에서",
      icon: <TrendingUp className="h-3 w-3" />,
    },
    video: {
      label: "From Video",
      labelKo: "영상에서",
      icon: <Video className="h-3 w-3" />,
    },
    idea: {
      label: "From Idea",
      labelKo: "아이디어에서",
      icon: <Lightbulb className="h-3 w-3" />,
    },
  };

  const status = statusConfig[session.status];
  // Use inferred contentType for badge display (handles legacy sessions with missing/incorrect metadata)
  const inferredContentTypeKey = isFastCut ? "fast-cut" : (session.metadata.contentType || "ai_video");
  const contentType = contentTypeConfig[inferredContentTypeKey] || null;
  const entrySource = session.metadata.entrySource
    ? entrySourceConfig[session.metadata.entrySource]
    : null;

  const title =
    session.metadata.title ||
    (language === "ko" ? "이름 없는 프로젝트" : "Untitled Project");

  return (
    <>
      <div
        className={cn(
          "group border rounded-xl p-4 transition-all hover:shadow-md cursor-pointer",
          isActive
            ? "border-neutral-900 bg-neutral-50 shadow-sm"
            : "border-neutral-200 bg-white hover:border-neutral-300"
        )}
        onClick={() => onResume(session.id)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
              <Video className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 line-clamp-1">
                {title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className={cn("text-[10px] px-1.5 py-0", status.color)}>
                  {status.icon}
                  <span className="ml-1">
                    {language === "ko" ? status.labelKo : status.label}
                  </span>
                </Badge>
                {entrySource && (
                  <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                    {entrySource.icon}
                    {language === "ko" ? entrySource.labelKo : entrySource.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onResume(session.id)}>
                <Play className="h-4 w-4 mr-2" />
                {language === "ko" ? "계속하기" : "Resume"}
              </DropdownMenuItem>
              {session.status === "in_progress" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onPause(session.id);
                  }}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  {language === "ko" ? "일시 중지" : "Pause"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {language === "ko" ? "삭제" : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Progress Stages */}
        <div className="flex items-center gap-1 mb-3">
          {stages.map((stage, index) => {
            // CRITICAL FIX: Improved stage completion logic
            // A stage is completed if:
            // 1. Session status is "completed" (all stages done), OR
            // 2. It's explicitly in completedStages, OR
            // 3. Its index is less than the current stage index (already passed)
            const isSessionCompleted = session.status === "completed";
            const isInCompletedStages = (session.completedStages as string[]).includes(stage);
            const isBeforeCurrentStage = index < currentStageIndex;
            const isCompleted = isSessionCompleted || isInCompletedStages || isBeforeCurrentStage;

            // Current stage: only show as current if session is not completed
            const isCurrent = !isSessionCompleted && stage === session.currentStage;

            return (
              <div key={stage} className="flex items-center">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-colors",
                    index === 0 ? "w-8" : "w-6",
                    isCompleted
                      ? "bg-neutral-900"
                      : isCurrent
                      ? "bg-neutral-400"
                      : "bg-neutral-200"
                  )}
                />
                {index < stages.length - 1 && (
                  <ChevronRight
                    className={cn(
                      "h-3 w-3",
                      isCompleted ? "text-neutral-900" : "text-neutral-300"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Stage Labels */}
        <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-3">
          <span>Start</span>
          <span className={cn(
            "font-medium",
            session.status === "completed" ? "text-green-600" : "text-neutral-600"
          )}>
            {session.status === "completed"
              ? (language === "ko" ? "완료됨" : "Completed")
              : (session.currentStage.charAt(0).toUpperCase() + session.currentStage.slice(1))}
          </span>
          <span>Publish</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-neutral-500 pt-3 border-t border-neutral-100">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(session.updatedAt)}
          </span>
          {contentType && (
            <span className="flex items-center gap-1">
              {contentType.icon}
              {language === "ko" ? contentType.labelKo : contentType.label}
            </span>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ko" ? "프로젝트 삭제" : "Delete Project"}
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                {language === "ko"
                  ? "이 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
                  : "Are you sure you want to delete this project? This action cannot be undone."}
              </span>
              {hasActiveJobs && (
                <span className="block text-destructive font-medium">
                  {language === "ko"
                    ? "⚠️ 현재 진행 중인 작업이 있습니다. 삭제하면 진행 중인 작업도 함께 취소됩니다."
                    : "⚠️ There are active tasks running. Deleting will also cancel the running tasks."}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              {language === "ko" ? "취소" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(session.id, hasActiveJobs);
                setShowDeleteConfirm(false);
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {language === "ko" ? "삭제 중..." : "Deleting..."}
                </>
              ) : hasActiveJobs ? (
                language === "ko" ? "작업 취소 및 삭제" : "Cancel Tasks & Delete"
              ) : (
                language === "ko" ? "삭제" : "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Completed Session Card (Simplified)
// ============================================================================

interface CompletedCardProps {
  session: SessionSummary;
  onClick: () => void;
}

function CompletedSessionCard({ session, onClick }: CompletedCardProps) {
  const { language } = useI18n();

  // Infer content type
  const FAST_CUT_ONLY_STAGES = ["script", "images", "music", "effects", "render"];
  const isFastCut =
    session.metadata.contentType === "fast-cut" ||
    FAST_CUT_ONLY_STAGES.includes(session.currentStage) ||
    session.completedStages?.some(stage => FAST_CUT_ONLY_STAGES.includes(stage));

  const title =
    session.metadata.title ||
    (language === "ko" ? "이름 없는 프로젝트" : "Untitled Project");

  return (
    <div
      className="group border border-neutral-200 rounded-lg p-3 bg-white hover:border-neutral-300 hover:shadow-sm cursor-pointer transition-all"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isFastCut ? "bg-purple-100" : "bg-neutral-900"
        )}>
          {isFastCut ? (
            <Sparkles className="h-4 w-4 text-purple-600" />
          ) : (
            <Video className="h-4 w-4 text-white" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-neutral-900 truncate">
            {title}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-neutral-500">
              {isFastCut ? "Fast Cut" : (language === "ko" ? "AI 영상" : "AI Video")}
            </span>
            <span className="text-neutral-300">·</span>
            <span className="text-xs text-neutral-400">
              {formatRelativeTime(session.updatedAt)}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500 transition-colors flex-shrink-0" />
      </div>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  const { language } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-2xl bg-neutral-100 flex items-center justify-center mb-6">
        <Video className="h-10 w-10 text-neutral-400" />
      </div>
      <h2 className="text-xl font-semibold text-neutral-900 mb-2">
        {language === "ko" ? "첫 번째 영상을 만들어보세요" : "Create Your First Video"}
      </h2>
      <p className="text-sm text-neutral-500 text-center max-w-md mb-6">
        {language === "ko"
          ? "트렌드를 분석하고 AI로 영상을 생성하세요. 진행 상황은 자동으로 저장됩니다."
          : "Analyze trends and generate videos with AI. Your progress is automatically saved."}
      </p>
      <Button onClick={onCreateNew} className="gap-2">
        <Plus className="h-4 w-4" />
        {language === "ko" ? "새로 만들기" : "Create New"}
      </Button>
    </div>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

export function SessionDashboard() {
  const router = useRouter();
  const { language } = useI18n();

  // Store
  const {
    sessions,
    sessionsLoading,
    fetchSessions,
    createSession,
    loadSession,
    pauseSession,
    deleteSession,
  } = useSessionStore(
    useShallow((state) => ({
      sessions: state.sessions,
      sessionsLoading: state.sessionsLoading,
      fetchSessions: state.fetchSessions,
      createSession: state.createSession,
      loadSession: state.loadSession,
      pauseSession: state.pauseSession,
      deleteSession: state.deleteSession,
    }))
  );

  // Get user and hydration status from auth store
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);

  // Get active jobs from job store
  const jobs = useJobStore((state) => state.jobs);
  const hasActiveJobs = jobs.some(
    (job) => job.status === "QUEUED" || job.status === "PROCESSING"
  );

  // Derived state - use useShallow to prevent infinite loop from filter creating new arrays
  const inProgressSessions = useSessionStore(useShallow(selectInProgressSessions));
  const completedSessions = useSessionStore(useShallow(selectCompletedSessions));
  const pausedSessions = useSessionStore(useShallow(selectPausedSessions));

  // Local state
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isInProgressExpanded, setIsInProgressExpanded] = useState(false);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const [selectedDetailSessionId, setSelectedDetailSessionId] = useState<string | null>(null);

  // Fetch sessions on mount - wait for auth hydration
  useEffect(() => {
    // Only fetch when auth store is hydrated and user is available
    if (!hasHydrated) {
      console.log("[SessionDashboard] Waiting for auth hydration...");
      return;
    }

    if (!user?.id) {
      console.log("[SessionDashboard] No user after hydration, clearing sessions");
      return;
    }

    console.log("[SessionDashboard] Auth hydrated, fetching sessions for user:", user.id);
    fetchSessions({ userId: user.id });
  }, [fetchSessions, hasHydrated, user?.id]);

  // Stage to route mapping (using existing routes for compatibility)
  const stageToRoute: Record<string, string> = {
    // AI Video stages
    start: "/start",
    analyze: "/analyze",
    create: "/create/workflow",
    processing: "/processing",
    publish: "/publish",
    // Fast Cut stages (script now redirects to images for legacy sessions)
    script: "/fast-cut/images",
    images: "/fast-cut/images",
    music: "/fast-cut/music",
    effects: "/fast-cut/effects",
    render: "/processing",
  };

  // Handlers
  const handleCreateNew = async () => {
    if (!user?.id) {
      console.error("Cannot create session: User not authenticated");
      return;
    }

    setIsCreating(true);
    try {
      const sessionId = await createSession({ userId: user.id });
      // Navigate to start with session context
      router.push(`/start?session=${sessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleResume = async (sessionId: string) => {
    try {
      await loadSession(sessionId);
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        const route = stageToRoute[session.currentStage] || "/start";
        router.push(`${route}?session=${sessionId}`);
      }
    } catch (error) {
      console.error("Failed to resume session:", error);
    }
  };

  const handlePause = async (sessionId: string) => {
    try {
      await loadSession(sessionId);
      await pauseSession();
      await fetchSessions();
    } catch (error) {
      console.error("Failed to pause session:", error);
    }
  };

  const handleDelete = async (sessionId: string, cancelJobs?: boolean) => {
    setIsDeleting(true);
    try {
      // Cancel all active jobs if requested
      if (cancelJobs && accessToken) {
        try {
          const response = await fetch("/api/v1/jobs/cancel-all", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          if (response.ok) {
            // Clear jobs from store immediately
            useJobStore.getState().setJobs([]);
          }
        } catch {
          console.error("Failed to cancel jobs");
        }
      }
      // Delete the session
      await deleteSession(sessionId);
    } catch (error) {
      console.error("Failed to delete session:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if there are any sessions
  const hasSessions =
    inProgressSessions.length > 0 ||
    completedSessions.length > 0 ||
    pausedSessions.length > 0;

  return (
    <div className="min-h-full bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                {language === "ko" ? "비디오 만들기" : "Video Create"}
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                {language === "ko"
                  ? "AI로 트렌디한 영상을 만들어보세요"
                  : "Create trendy videos with AI"}
              </p>
            </div>
            <Button
              onClick={handleCreateNew}
              disabled={isCreating}
              className="gap-2"
            >
              {isCreating ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {language === "ko" ? "새로 만들기" : "Create New"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {!hasHydrated || sessionsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-neutral-500">
              {language === "ko" ? "로그인이 필요합니다" : "Please log in to continue"}
            </p>
          </div>
        ) : !hasSessions ? (
          <EmptyState onCreateNew={handleCreateNew} />
        ) : (
          <div className="space-y-8">
            {/* In Progress Sessions */}
            {inProgressSessions.length > 0 && (
              <section>
                <button
                  onClick={() => setIsInProgressExpanded(!isInProgressExpanded)}
                  className="flex items-center gap-2 mb-4 w-full group"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
                    {language === "ko" ? "진행 중인 작업" : "In Progress"}
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {inProgressSessions.length}
                  </Badge>
                  {inProgressSessions.length > 6 && (
                    <div className="ml-auto flex items-center gap-1 text-neutral-400 group-hover:text-neutral-600 transition-colors">
                      <span className="text-xs">
                        {isInProgressExpanded
                          ? (language === "ko" ? "접기" : "Collapse")
                          : (language === "ko" ? "펼치기" : "Expand")}
                      </span>
                      {isInProgressExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  )}
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(isInProgressExpanded ? inProgressSessions : inProgressSessions.slice(0, 6)).map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onResume={handleResume}
                      onPause={handlePause}
                      onDelete={handleDelete}
                      isActive
                      hasActiveJobs={hasActiveJobs}
                      isDeleting={isDeleting}
                    />
                  ))}
                </div>
                {!isInProgressExpanded && inProgressSessions.length > 6 && (
                  <p className="mt-3 text-center text-xs text-neutral-400">
                    {language === "ko"
                      ? `최근 6개만 표시됩니다. (전체 ${inProgressSessions.length}개)`
                      : `Showing 6 most recent. (${inProgressSessions.length} total)`}
                  </p>
                )}
              </section>
            )}

            {/* Paused Sessions */}
            {pausedSessions.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
                    {language === "ko" ? "일시 중지됨" : "Paused"}
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {pausedSessions.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pausedSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onResume={handleResume}
                      onPause={handlePause}
                      onDelete={handleDelete}
                      hasActiveJobs={hasActiveJobs}
                      isDeleting={isDeleting}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed Sessions */}
            {completedSessions.length > 0 && (
              <section>
                <button
                  onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                  className="flex items-center gap-2 mb-4 w-full group"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
                    {language === "ko" ? "완료됨" : "Completed"}
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {completedSessions.length}
                  </Badge>
                  <div className="ml-auto flex items-center gap-1 text-neutral-400 group-hover:text-neutral-600 transition-colors">
                    <span className="text-xs">
                      {isCompletedExpanded
                        ? (language === "ko" ? "접기" : "Collapse")
                        : (language === "ko" ? "펼치기" : "Expand")}
                    </span>
                    {isCompletedExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </button>
                {isCompletedExpanded && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {completedSessions.slice(0, 6).map((session) => (
                        <CompletedSessionCard
                          key={session.id}
                          session={session}
                          onClick={() => setSelectedDetailSessionId(session.id)}
                        />
                      ))}
                    </div>
                    {completedSessions.length > 6 && (
                      <p className="mt-3 text-center text-xs text-neutral-400">
                        {language === "ko"
                          ? `최근 6개만 표시됩니다. (전체 ${completedSessions.length}개)`
                          : `Showing 6 most recent. (${completedSessions.length} total)`}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      <SessionDetailModal
        sessionId={selectedDetailSessionId}
        open={!!selectedDetailSessionId}
        onClose={() => setSelectedDetailSessionId(null)}
      />
    </div>
  );
}

export default SessionDashboard;
