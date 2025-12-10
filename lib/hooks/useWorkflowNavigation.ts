"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import {
  useWorkflowStore,
  WorkflowStage,
  selectCanProceedToAnalyze,
  selectCanProceedToCreate,
  selectCanProceedToProcessing,
  selectCanProceedToPublish,
} from "@/lib/stores/workflow-store";

export interface WorkflowNavigationResult {
  currentStage: WorkflowStage;
  completedStages: WorkflowStage[];
  setCurrentStage: (stage: WorkflowStage) => void;

  // Navigation functions
  goToStart: () => void;
  goToAnalyze: () => void;
  goToCreate: () => void;
  goToProcessing: () => void;
  goToPublish: () => void;
  goToStage: (stage: WorkflowStage) => void;

  // Proceed functions (with data transfer)
  proceedToAnalyze: () => void;
  proceedToCreate: () => void;
  proceedToProcessing: () => void;
  proceedToPublish: () => void;

  // Validation
  canProceedToAnalyze: boolean;
  canProceedToCreate: boolean;
  canProceedToProcessing: boolean;
  canProceedToPublish: boolean;

  // Reset
  resetWorkflow: () => void;

  // Stage info
  getStageInfo: (stage: WorkflowStage) => StageInfo;
  stages: StageInfo[];
}

export interface StageInfo {
  id: WorkflowStage;
  label: { ko: string; en: string };
  description: { ko: string; en: string };
  route: string;
  icon: string;
  isCompleted: boolean;
  isCurrent: boolean;
  canNavigate: boolean;
}

const STAGE_CONFIG: Record<
  WorkflowStage,
  Omit<StageInfo, "isCompleted" | "isCurrent" | "canNavigate">
> = {
  start: {
    id: "start",
    label: { ko: "시작", en: "Start" },
    description: { ko: "새 콘텐츠 시작하기", en: "Start new content" },
    route: "/start",
    icon: "Zap",
  },
  analyze: {
    id: "analyze",
    label: { ko: "분석", en: "Analyze" },
    description: { ko: "아이디어 정리 및 AI 브리프 생성", en: "Organize ideas and create AI brief" },
    route: "/analyze",
    icon: "Lightbulb",
  },
  create: {
    id: "create",
    label: { ko: "생성", en: "Create" },
    description: { ko: "AI 영상 또는 컴포즈 영상 생성", en: "Generate AI or compose videos" },
    route: "/create/workflow",
    icon: "Video",
  },
  processing: {
    id: "processing",
    label: { ko: "프로세싱", en: "Processing" },
    description: { ko: "생성된 영상 확인 및 품질 검토", en: "Review generated videos and quality check" },
    route: "/processing",
    icon: "Loader2",
  },
  publish: {
    id: "publish",
    label: { ko: "발행", en: "Publish" },
    description: { ko: "SNS 채널에 스케줄 발행", en: "Schedule and publish to SNS channels" },
    route: "/publish",
    icon: "Send",
  },
  // Fast Cut stages
  script: {
    id: "script",
    label: { ko: "스크립트", en: "Script" },
    description: { ko: "AI 스크립트 생성", en: "Generate AI script" },
    route: "/fast-cut/script",
    icon: "FileText",
  },
  images: {
    id: "images",
    label: { ko: "이미지", en: "Images" },
    description: { ko: "이미지 검색 및 선택", en: "Search and select images" },
    route: "/fast-cut/images",
    icon: "Image",
  },
  music: {
    id: "music",
    label: { ko: "음악", en: "Music" },
    description: { ko: "배경 음악 선택", en: "Select background music" },
    route: "/fast-cut/music",
    icon: "Music",
  },
  effects: {
    id: "effects",
    label: { ko: "효과", en: "Effects" },
    description: { ko: "스타일 및 효과 설정", en: "Set style and effects" },
    route: "/fast-cut/effects",
    icon: "Sparkles",
  },
  render: {
    id: "render",
    label: { ko: "렌더링", en: "Render" },
    description: { ko: "영상 렌더링 중", en: "Rendering video" },
    route: "/processing",
    icon: "Loader2",
  },
};

const STAGE_ORDER: WorkflowStage[] = ["start", "analyze", "create", "processing", "publish"];
const FAST_CUT_STAGE_ORDER: WorkflowStage[] = ["start", "script", "images", "music", "effects", "render", "publish"];

export function useWorkflowNavigation(): WorkflowNavigationResult {
  const router = useRouter();

  const currentStage = useWorkflowStore((state) => state.currentStage);
  const completedStages = useWorkflowStore((state) => state.completedStages);
  const setCurrentStage = useWorkflowStore((state) => state.setCurrentStage);
  const transferToAnalyze = useWorkflowStore((state) => state.transferToAnalyze);
  const transferToCreate = useWorkflowStore((state) => state.transferToCreate);
  const transferToProcessing = useWorkflowStore((state) => state.transferToProcessing);
  const transferToPublish = useWorkflowStore((state) => state.transferToPublish);
  const resetWorkflowStore = useWorkflowStore((state) => state.resetWorkflow);

  const canProceedToAnalyze = useWorkflowStore(selectCanProceedToAnalyze);
  const canProceedToCreate = useWorkflowStore(selectCanProceedToCreate);
  const canProceedToProcessing = useWorkflowStore(selectCanProceedToProcessing);
  const canProceedToPublish = useWorkflowStore(selectCanProceedToPublish);

  // Simple navigation (just changes route)
  const goToStart = useCallback(() => {
    setCurrentStage("start");
    router.push("/start");
  }, [router, setCurrentStage]);

  const goToAnalyze = useCallback(() => {
    setCurrentStage("analyze");
    router.push("/analyze");
  }, [router, setCurrentStage]);

  const goToCreate = useCallback(() => {
    setCurrentStage("create");
    router.push("/create/workflow");
  }, [router, setCurrentStage]);

  const goToProcessing = useCallback(() => {
    setCurrentStage("processing");
    router.push("/processing");
  }, [router, setCurrentStage]);

  const goToPublish = useCallback(() => {
    setCurrentStage("publish");
    router.push("/publish");
  }, [router, setCurrentStage]);

  const goToStage = useCallback(
    (stage: WorkflowStage) => {
      setCurrentStage(stage);
      router.push(STAGE_CONFIG[stage].route);
    },
    [router, setCurrentStage]
  );

  // Proceed functions (transfer data and navigate)
  const proceedToAnalyze = useCallback(() => {
    if (!canProceedToAnalyze) return;
    transferToAnalyze();
    router.push("/analyze");
  }, [router, transferToAnalyze, canProceedToAnalyze]);

  const proceedToCreate = useCallback(() => {
    if (!canProceedToCreate) return;
    transferToCreate();
    router.push("/create/workflow");
  }, [router, transferToCreate, canProceedToCreate]);

  const proceedToProcessing = useCallback(() => {
    if (!canProceedToProcessing) return;
    transferToProcessing();
    router.push("/processing");
  }, [router, transferToProcessing, canProceedToProcessing]);

  const proceedToPublish = useCallback(() => {
    if (!canProceedToPublish) return;
    transferToPublish();
    router.push("/publish");
  }, [router, transferToPublish, canProceedToPublish]);

  // Reset workflow
  const resetWorkflow = useCallback(() => {
    resetWorkflowStore();
    router.push("/start");
  }, [router, resetWorkflowStore]);

  // Get stage info with dynamic state
  const getStageInfo = useCallback(
    (stage: WorkflowStage): StageInfo => {
      const config = STAGE_CONFIG[stage];
      const stageIndex = STAGE_ORDER.indexOf(stage);
      const currentIndex = STAGE_ORDER.indexOf(currentStage);

      // Can navigate if:
      // 1. It's a previous or current stage
      // 2. OR it's completed
      // 3. OR it's the next stage and current stage is completed
      const isCompleted = completedStages.includes(stage);
      const isCurrent = currentStage === stage;
      const isPrevious = stageIndex < currentIndex;
      const isNext = stageIndex === currentIndex + 1;
      const currentIsCompleted = completedStages.includes(currentStage);

      let canNavigate = false;
      if (isCurrent || isPrevious || isCompleted) {
        canNavigate = true;
      } else if (isNext && currentIsCompleted) {
        canNavigate = true;
      }

      return {
        ...config,
        isCompleted,
        isCurrent,
        canNavigate,
      };
    },
    [currentStage, completedStages]
  );

  // All stages with their current state
  const stages = STAGE_ORDER.map(getStageInfo);

  return {
    currentStage,
    completedStages,
    setCurrentStage,
    goToStart,
    goToAnalyze,
    goToCreate,
    goToProcessing,
    goToPublish,
    goToStage,
    proceedToAnalyze,
    proceedToCreate,
    proceedToProcessing,
    proceedToPublish,
    canProceedToAnalyze,
    canProceedToCreate,
    canProceedToProcessing,
    canProceedToPublish,
    resetWorkflow,
    getStageInfo,
    stages,
  };
}

// AI Video stages that have corresponding data in WorkflowState
type AIVideoStage = "start" | "analyze" | "create" | "processing" | "publish";

// Hook to sync URL with workflow stage (AI Video only)
export function useWorkflowSync(expectedStage: AIVideoStage) {
  const setCurrentStage = useWorkflowStore((state) => state.setCurrentStage);
  const stageData = useWorkflowStore((state) => state[expectedStage]);

  // Sync on mount using useEffect to avoid side effects during render
  useEffect(() => {
    setCurrentStage(expectedStage);
  }, [expectedStage, setCurrentStage]);

  return stageData;
}
