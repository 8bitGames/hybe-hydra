import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type JobType =
  | "VIDEO_GENERATION"
  | "VIDEO_COMPOSE"
  | "BATCH_GENERATION"
  | "TREND_COLLECT"
  | "TREND_ANALYZE_TEXT"
  | "TREND_ANALYZE_VIDEO"
  | "TREND_REPORT"
  | "PUBLISH"
  | "SCORE_ALL";

export type JobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;

  // Localized messages
  title: { ko: string; en: string };
  currentStep?: { ko: string; en: string };

  // Context
  campaignId?: string;
  campaignName?: string;
  generationId?: string;

  // Timing
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number; // seconds

  // Result
  result?: {
    outputUrl?: string;
    score?: number;
    error?: string;
  };
}

interface JobState {
  jobs: Job[];
  recentJobs: Job[];
  isLoading: boolean;
  error: string | null;

  // Actions
  addJob: (job: Job) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  setJobs: (jobs: Job[]) => void;
  setRecentJobs: (jobs: Job[]) => void;
  clearCompletedJobs: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useJobStore = create<JobState>()(
  subscribeWithSelector((set) => ({
    jobs: [],
    recentJobs: [],
    isLoading: false,
    error: null,

    addJob: (job) =>
      set((state) => ({
        jobs: [...state.jobs, job],
      })),

    updateJob: (id, updates) =>
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === id ? { ...job, ...updates } : job
        ),
      })),

    removeJob: (id) =>
      set((state) => ({
        jobs: state.jobs.filter((job) => job.id !== id),
      })),

    setJobs: (jobs) => set({ jobs }),

    setRecentJobs: (recentJobs) => set({ recentJobs }),

    clearCompletedJobs: () =>
      set((state) => ({
        jobs: state.jobs.filter(
          (job) => job.status !== "COMPLETED" && job.status !== "FAILED"
        ),
      })),

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),
  }))
);

// Computed selectors
export const selectActiveJobs = (state: JobState) =>
  state.jobs.filter(
    (job) => job.status === "QUEUED" || job.status === "PROCESSING"
  );

export const selectCompletedJobs = (state: JobState) =>
  state.jobs.filter((job) => job.status === "COMPLETED");

export const selectFailedJobs = (state: JobState) =>
  state.jobs.filter((job) => job.status === "FAILED");

export const selectJobCounts = (state: JobState) => ({
  queued: state.jobs.filter((j) => j.status === "QUEUED").length,
  processing: state.jobs.filter((j) => j.status === "PROCESSING").length,
  completed: state.jobs.filter((j) => j.status === "COMPLETED").length,
  failed: state.jobs.filter((j) => j.status === "FAILED").length,
  total: state.jobs.length,
});

// Job type labels for display
export const JOB_TYPE_LABELS: Record<JobType, { ko: string; en: string }> = {
  VIDEO_GENERATION: { ko: "영상 생성", en: "Video Generation" },
  VIDEO_COMPOSE: { ko: "슬라이드쇼 렌더링", en: "Slideshow Rendering" },
  BATCH_GENERATION: { ko: "대량 생성", en: "Batch Generation" },
  TREND_COLLECT: { ko: "트렌드 수집", en: "Trend Collection" },
  TREND_ANALYZE_TEXT: { ko: "텍스트 트렌드 분석", en: "Text Trend Analysis" },
  TREND_ANALYZE_VIDEO: { ko: "영상 트렌드 분석", en: "Video Trend Analysis" },
  TREND_REPORT: { ko: "트렌드 리포트", en: "Trend Report" },
  PUBLISH: { ko: "발행", en: "Publishing" },
  SCORE_ALL: { ko: "전체 점수 계산", en: "Score All Videos" },
};

// Job status labels for display
export const JOB_STATUS_LABELS: Record<JobStatus, { ko: string; en: string }> = {
  QUEUED: { ko: "대기중", en: "Queued" },
  PROCESSING: { ko: "처리중", en: "Processing" },
  COMPLETED: { ko: "완료", en: "Completed" },
  FAILED: { ko: "실패", en: "Failed" },
  CANCELLED: { ko: "취소됨", en: "Cancelled" },
};
