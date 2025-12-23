// Internationalization translations
export type Language = "ko" | "en";

export interface Translations {
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    create: string;
    search: string;
    filter: string;
    all: string;
    none: string;
    confirm: string;
    back: string;
    next: string;
    previous: string;
    submit: string;
    close: string;
    view: string;
    more: string;
    logout: string;
    remove: string;
    selected: string;
    upload: string;
    uploading: string;
    selectFile: string;
    preview: string;
    noData: string;
    image: string;
    video: string;
    audio: string;
    views: string;
    uploadSuccess: string;
    uploadFailed: string;
    fileSizeLimit: string;
    fileTypeError: string;
    deleteConfirm: string;
  };
  navigation: {
    dashboard: string;
    bridge: string;
    campaigns: string;
    assets: string;
    trends: string;
    publish: string;
    settings: string;
  };
  dashboard: {
    welcome: string;
    welcomeMessage: string;
    totalCampaigns: string;
    activeCampaigns: string;
    draftCampaigns: string;
    recentCampaigns: string;
    newCampaign: string;
    noCampaigns: string;
    createFirst: string;
    viewAll: string;
    role: string;
  };
  bridge: {
    title: string;
    subtitle: string;
    trendRadar: string;
    realTimeTrends: string;
    promptAlchemist: string;
    selectCampaign: string;
    enterIdea: string;
    ideaPlaceholder: string;
    transform: string;
    transforming: string;
    optimizedPrompt: string;
    analysis: string;
    generateVideo: string;
    recentVideos: string;
    noVideos: string;
    maxTrends: string;
    maxTrendsMessage: string;
    transformSuccess: string;
    transformSuccessMessage: string;
    safetyFailed: string;
    errorOccurred: string;
    appliedTrends: string;
    assetLocker: string;
    // TikTok Analyzer
    tiktokStyleAnalysis: string;
    enterTiktokUrl: string;
    tiktokUrlPlaceholder: string;
    invalidTiktokUrl: string;
    analysisFailed: string;
    analysisComplete: string;
    videoStyleAnalyzed: string;
    noPromptGenerated: string;
    promptApplied: string;
    analysisApplied: string;
    styleAnalysis: string;
    mood: string;
    pace: string;
    recommendation: string;
    generatedPrompt: string;
    generateWithStyle: string;
    fetchFromUrl: string;
    // Asset Locker
    campaignAssets: string;
    selectCampaignFirst: string;
    noAssets: string;
    uploadAssets: string;
    campaignDetailPage: string;
    // Scraped data
    hashtagsExtracted: string;
    hashtagsExtractedMessage: string;
    // Prompt
    promptTransferred: string;
    navigateToGenerate: string;
    // Celebrity warning
    celebrityDetected: string;
    celebrityWarningMessage: string;
    // Technical settings
    aspectRatioLabel: string;
    fpsLabel: string;
    durationLabel: string;
    viewAllVideos: string;
  };
  campaigns: {
    title: string;
    create: string;
    edit: string;
    delete: string;
    name: string;
    description: string;
    artist: string;
    status: string;
    startDate: string;
    endDate: string;
    targetCountries: string;
    createdAt: string;
    assets: string;
    generations: string;
    generate: string;
    curation: string;
    publish: string;
    statuses: {
      draft: string;
      active: string;
      completed: string;
      archived: string;
    };
  };
  generation: {
    title: string;
    prompt: string;
    negativePrompt: string;
    duration: string;
    aspectRatio: string;
    referenceImage: string;
    stylePreset: string;
    generate: string;
    generating: string;
    batch: string;
    batchGenerate: string;
    selectPresets: string;
    status: {
      pending: string;
      processing: string;
      completed: string;
      failed: string;
      cancelled: string;
    };
    stats: {
      total: string;
      pending: string;
      processing: string;
      completed: string;
      failed: string;
    };
    // Trending
    trendingNow: string;
    trendingDescription: string;
    noTrendsFound: string;
    // Form
    newGeneration: string;
    promptRequired: string;
    promptPlaceholder: string;
    promptTip: string;
    optimizing: string;
    optimizeWithAI: string;
    promptOptimized: string;
    viewOptimizedPrompt: string;
    negativePromptPlaceholder: string;
    durationAutoCalc: string;
    stylePresets: string;
    clearAll: string;
    selectedCount: string;
    batchStylesInfo: string;
    // History
    generationHistory: string;
    noGenerationsYet: string;
    startGeneratingHint: string;
    scoreAll: string;
    scoring: string;
    overall: string;
    promptQuality: string;
    technical: string;
    style: string;
    trend: string;
    recommendations: string;
    viewVideo: string;
    viewVideoWithAudio: string;
    viewVideoNoAudio: string;
    createVariation: string;
    cancel: string;
    delete: string;
    score: string;
    grade: string;
    // Audio
    audioSelection: string;
    audioRequired: string;
    noAudioUploaded: string;
    uploadAudioGuide: string;
    audioFormats: string;
    audioSyncInfo: string;
    showList: string;
    uploadNewAudio: string;
    // Reference source
    referenceSource: string;
    goods: string;
    selectedGoods: string;
    searchGoods: string;
    goodsNotFound: string;
    maxGoodsMessage: string;
    // Image guide
    imageGuideGeneration: string;
    imageBasedGenerating: string;
    // Bridge integration
    bridgePromptLoaded: string;
    bridgePromptMessage: string;
    // Watch video
    watchVideo: string;
    watchVideoNoAudio: string;
    // I2V
    imageReference: string;
    imageReferenceOptional: string;
    imageReferenceDescription: string;
    selectFromAssetLocker: string;
    i2vModeInfo: string;
    // Image description
    imageUsageDescription: string;
    imageUsageRequired: string;
    imageUsagePlaceholder: string;
    changeImage: string;
    quickSelect: string;
    // Suggestions
    suggestion1: string;
    suggestion2: string;
    suggestion3: string;
    suggestion4: string;
    suggestion5: string;
    // Variations
    createVariations: string;
    variationModalTitle: string;
    variationModalDescription: string;
    fixedSettings: string;
    styleVariationCategories: string;
    aiPromptVariations: string;
    promptVariationDescription: string;
    cameraAngles: string;
    expressions: string;
    maxVariations: string;
    maxVariationsDescription: string;
    estimatedVariations: string;
    selectCategories: string;
    generateVariations: string;
    creatingVariations: string;
    variationCostWarning: string;
  };
  pipeline: {
    title: string;
    description: string;
    noPipelines: string;
    noPipelinesDescription: string;
    goToGenerate: string;
    newVariation: string;
    refresh: string;
    totalPipelines: string;
    processing: string;
    completed: string;
    partialFailure: string;
    pending: string;
    viewDetails: string;
    toCuration: string;
    pause: string;
    delete: string;
    variations: string;
    seedVideo: string;
    pipelineDetail: string;
    progress: string;
    selectCompleted: string;
    deselectAll: string;
    searchPlaceholder: string;
  };
  curation: {
    title: string;
    mosaicView: string;
    compare: string;
    approve: string;
    refine: string;
    delete: string;
    selectForComparison: string;
    scoreAll: string;
    filterByStatus: string;
    filterByScore: string;
    sortBy: string;
    caption: string;
    generateCaption: string;
  };
  publishing: {
    title: string;
    schedule: string;
    accounts: string;
    connectAccount: string;
    selectPlatform: string;
    selectVideo: string;
    caption: string;
    hashtags: string;
    scheduledTime: string;
    timezone: string;
    status: {
      draft: string;
      scheduled: string;
      publishing: string;
      published: string;
      failed: string;
      cancelled: string;
    };
    platforms: {
      tiktok: string;
      youtube: string;
      instagram: string;
      twitter: string;
    };
  };
  errors: {
    general: string;
    networkError: string;
    unauthorized: string;
    forbidden: string;
    notFound: string;
    validation: string;
    serverError: string;
    tryAgain: string;
  };
  createPage: {
    title: string;
    subtitle: string;
    modes: {
      quick: {
        name: string;
        description: string;
      };
      generate: {
        name: string;
        description: string;
      };
      compose: {
        name: string;
        description: string;
      };
      batch: {
        name: string;
        description: string;
      };
    };
    hints: {
      quickModeInfo: string;
      needMoreControl: string;
    };
  };
  campaignWorkspace: {
    tabs: {
      assets: string;
      create: string;
      generate: string;
      compose: string;
      videos: string;
      publish: string;
      analytics: string;
      info: string;
    };
  };
  workspace: {
    // Stats
    generated: string;
    highQuality: string;
    published: string;
    prompts: string;
    totalViews: string;
    totalLikes: string;
    // Tabs
    timeline: string;
    promptLibrary: string;
    references: string;
    gallery: string;
    publishing: string;
    // Timeline
    workHistory: string;
    chronologicalView: string;
    noActivityYet: string;
    startGenerating: string;
    videoGeneration: string;
    // Prompts
    allPromptsUsed: string;
    clickToReuse: string;
    noPromptsYet: string;
    viewOptimizedPrompt: string;
    used: string;
    success: string;
    avg: string;
    last: string;
    copyPrompt: string;
    reuse: string;
    // References
    trendsUsed: string;
    keywordsApplied: string;
    noTrendsUsed: string;
    successful: string;
    referenceUrls: string;
    externalLinks: string;
    noReferenceUrls: string;
    // Gallery
    generatedVideos: string;
    allVideosGenerated: string;
    searchPrompts: string;
    allStatus: string;
    noVideosFound: string;
    // Publishing
    publishedContent: string;
    snsStatus: string;
    noPublishedContent: string;
    publishContent: string;
    // Video Modal
    videoPreview: string;
    details: string;
    duration: string;
    aspectRatio: string;
    created: string;
    status: string;
    trendsApplied: string;
    referenceImage: string;
    merchandise: string;
    generateSimilar: string;
    withAudio: string;
    loading: string;
    loadError: string;
    tryAgain: string;
  };
  publish: {
    // Page header
    title: string;
    manageSchedule: string;
    // Stats
    total: string;
    publishing: string;
    scheduled: string;
    published: string;
    drafts: string;
    failed: string;
    cancelled: string;
    // View tabs
    queue: string;
    list: string;
    calendar: string;
    allPlatforms: string;
    // Connected
    connected: string;
    noAccountsConnected: string;
    // Empty state
    noScheduledPosts: string;
    connectAccountsMessage: string;
    generateVideosFirst: string;
    scheduleFirstPost: string;
    contactAdmin: string;
    generateVideos: string;
    // Post sections
    publishingPosts: string;
    scheduledPosts: string;
    draftPosts: string;
    publishedPosts: string;
    failedPosts: string;
    cancelledPosts: string;
    // Post card
    noCaption: string;
    cancelPost: string;
    deletePost: string;
    viewPost: string;
    inTime: string;
    error: string;
    retry: string;
    thumbnailExpired: string;
    noThumbnail: string;
    // Schedule modal
    schedulePost: string;
    selectVideo: string;
    publishTo: string;
    caption: string;
    scheduleTime: string;
    leaveEmptyForDraft: string;
    cancel: string;
    scheduling: string;
    saveAsDraft: string;
    // Calendar view
    calendarView: string;
    comingSoon: string;
    writeCaption: string;
  };
  compose: {
    title: string;
    subtitle: string;
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    stepScript: string;
    stepImages: string;
    stepMusic: string;
    stepRender: string;
    // Step 1: Script
    scriptGeneration: string;
    enterPrompt: string;
    promptPlaceholder: string;
    selectDuration: string;
    selectAspectRatio: string;
    generateScript: string;
    generatingScript: string;
    scriptPreview: string;
    vibeAnalysis: string;
    suggestedBpm: string;
    searchKeywords: string;
    effectRecommendation: string;
    totalDuration: string;
    editScript: string;
    // Step 2: Images
    imageSearch: string;
    searchingImages: string;
    searchResults: string;
    selectImages: string;
    selectedImages: string;
    minImagesRequired: string;
    maxImagesAllowed: string;
    uploadOwnImages: string;
    dragDropImages: string;
    imageQuality: string;
    noImagesFound: string;
    searchAgain: string;
    // Step 3: Music
    musicMatching: string;
    matchingMusic: string;
    matchedTracks: string;
    selectTrack: string;
    bpm: string;
    energy: string;
    matchScore: string;
    previewTrack: string;
    noTracksFound: string;
    uploadMusic: string;
    analyzingAudio: string;
    // Step 4: Render
    renderVideo: string;
    renderSettings: string;
    effectPreset: string;
    textStyle: string;
    colorGrade: string;
    startRender: string;
    renderProgress: string;
    renderComplete: string;
    renderFailed: string;
    downloadVideo: string;
    renderStep: string;
    estimatedTime: string;
    // Vibes
    vibeExciting: string;
    vibeEmotional: string;
    vibePop: string;
    vibeMinimal: string;
    // Common
    back: string;
    next: string;
    finish: string;
    reset: string;
    retry: string;
  };
}

export const translations: Record<Language, Translations> = {
  ko: {
    common: {
      loading: "로딩 중...",
      error: "오류",
      success: "성공",
      cancel: "취소",
      save: "저장",
      delete: "삭제",
      edit: "편집",
      create: "생성",
      search: "검색",
      filter: "필터",
      all: "전체",
      none: "없음",
      confirm: "확인",
      back: "뒤로",
      next: "다음",
      previous: "이전",
      submit: "제출",
      close: "닫기",
      view: "보기",
      more: "더 보기",
      logout: "로그아웃",
      remove: "제거",
      selected: "선택됨",
      upload: "업로드",
      uploading: "업로드 중...",
      selectFile: "파일 선택",
      preview: "미리 보기",
      noData: "데이터가 없습니다",
      image: "이미지",
      video: "비디오",
      audio: "오디오",
      views: "조회수",
      uploadSuccess: "업로드 완료",
      uploadFailed: "업로드에 실패했습니다",
      fileSizeLimit: "파일 크기는 {size}MB 이하만 가능합니다",
      fileTypeError: "{type} 파일만 업로드할 수 있습니다",
      deleteConfirm: "정말 삭제하시겠습니까?",
    },
    navigation: {
      dashboard: "대시보드",
      bridge: "브릿지",
      campaigns: "캠페인",
      assets: "에셋",
      trends: "트렌드",
      publish: "발행",
      settings: "설정",
    },
    dashboard: {
      welcome: "환영합니다",
      welcomeMessage: "AI 영상 생성을 시작할 준비가 되셨나요?",
      totalCampaigns: "전체 캠페인",
      activeCampaigns: "활성",
      draftCampaigns: "초안",
      recentCampaigns: "최근 캠페인",
      newCampaign: "새 캠페인",
      noCampaigns: "캠페인이 없습니다",
      createFirst: "첫 캠페인을 생성하세요",
      viewAll: "모두 보기",
      role: "역할",
    },
    bridge: {
      title: "브릿지",
      subtitle: "아이디어를 바이럴 영상으로 변환하세요",
      trendRadar: "트렌드 레이더",
      realTimeTrends: "실시간 트렌드",
      promptAlchemist: "프롬프트 연금술사",
      selectCampaign: "캠페인 선택...",
      enterIdea: "아이디어를 입력하세요",
      ideaPlaceholder: "예: 정국이 비 오는 거리에서 슬픈 춤을 추는 영상",
      transform: "프롬프트 변환",
      transforming: "변환 중...",
      optimizedPrompt: "최적화된 Veo 프롬프트",
      analysis: "분석",
      generateVideo: "영상 생성하기",
      recentVideos: "최근 영상",
      noVideos: "생성된 영상이 없습니다",
      maxTrends: "최대 3개까지",
      maxTrendsMessage: "트렌드 키워드는 최대 3개까지 선택 가능합니다",
      transformSuccess: "변환 완료",
      transformSuccessMessage: "프롬프트가 성공적으로 최적화되었습니다",
      safetyFailed: "안전 검사 실패",
      errorOccurred: "프롬프트 변환 중 오류가 발생했습니다",
      appliedTrends: "적용된 트렌드",
      assetLocker: "에셋 보관함",
      tiktokStyleAnalysis: "TikTok 스타일 분석",
      enterTiktokUrl: "TikTok URL을 입력하세요",
      tiktokUrlPlaceholder: "TikTok 영상 URL 붙여넣기...",
      invalidTiktokUrl: "올바른 TikTok URL이 아닙니다",
      analysisFailed: "분석 실패",
      analysisComplete: "분석 완료",
      videoStyleAnalyzed: "비디오 스타일이 성공적으로 분석되었습니다",
      noPromptGenerated: "프롬프트 없음",
      promptApplied: "프롬프트 적용됨",
      analysisApplied: "분석 결과가 프롬프트에 적용되었습니다",
      styleAnalysis: "스타일 분석",
      mood: "무드",
      pace: "페이스",
      recommendation: "추천",
      generatedPrompt: "생성된 프롬프트",
      generateWithStyle: "이 스타일로 프롬프트 생성",
      fetchFromUrl: "URL에서 트렌드 가져오기",
      campaignAssets: "{name}의 에셋",
      selectCampaignFirst: "캠페인을 선택하세요",
      noAssets: "에셋이 없습니다",
      uploadAssets: "에셋 업로드하기",
      campaignDetailPage: "캠페인 상세 페이지",
      hashtagsExtracted: "해시태그 추출 완료",
      hashtagsExtractedMessage: "{count}개의 해시태그를 가져왔습니다",
      promptTransferred: "프롬프트 전달됨",
      navigateToGenerate: "Generate 페이지로 이동합니다",
      celebrityDetected: "유명인 이름 감지됨",
      celebrityWarningMessage: "{names} 이름이 감지되어 자동으로 일반적인 설명으로 대체되었습니다. Google Veo는 실제 인물의 영상을 생성할 수 없습니다.",
      aspectRatioLabel: "비율",
      fpsLabel: "FPS",
      durationLabel: "길이",
      viewAllVideos: "모든 영상 보기",
    },
    campaigns: {
      title: "캠페인",
      create: "캠페인 생성",
      edit: "캠페인 편집",
      delete: "캠페인 삭제",
      name: "이름",
      description: "설명",
      artist: "아티스트",
      status: "상태",
      startDate: "시작일",
      endDate: "종료일",
      targetCountries: "대상 국가",
      createdAt: "생성일",
      assets: "에셋",
      generations: "생성물",
      generate: "생성",
      curation: "큐레이션",
      publish: "발행",
      statuses: {
        draft: "초안",
        active: "활성",
        completed: "완료",
        archived: "보관",
      },
    },
    generation: {
      title: "영상 생성",
      prompt: "프롬프트",
      negativePrompt: "네거티브 프롬프트",
      duration: "길이",
      aspectRatio: "비율",
      referenceImage: "참조 이미지",
      stylePreset: "스타일 프리셋",
      generate: "생성",
      generating: "생성 중...",
      batch: "배치",
      batchGenerate: "배치 생성",
      selectPresets: "프리셋 선택",
      status: {
        pending: "대기중",
        processing: "처리중",
        completed: "완료",
        failed: "실패",
        cancelled: "취소됨",
      },
      stats: {
        total: "전체",
        pending: "대기중",
        processing: "처리중",
        completed: "완료",
        failed: "실패",
      },
      // Trending
      trendingNow: "실시간 트렌드",
      trendingDescription: "트렌드를 클릭하여 프롬프트에 적용하세요",
      noTrendsFound: "이 플랫폼의 트렌드를 찾을 수 없습니다",
      // Form
      newGeneration: "새 생성",
      promptRequired: "프롬프트를 입력해주세요",
      promptPlaceholder: "생성할 영상을 설명하세요...",
      promptTip: "한국어 또는 영어로 작성하세요. AI가 최적화합니다.",
      optimizing: "최적화 중...",
      optimizeWithAI: "AI로 최적화",
      promptOptimized: "프롬프트 최적화됨",
      viewOptimizedPrompt: "최적화된 프롬프트 보기",
      negativePromptPlaceholder: "영상에서 피할 요소...",
      durationAutoCalc: "길이는 자동 계산됩니다 (10-30초)",
      stylePresets: "스타일 프리셋",
      clearAll: "모두 지우기",
      selectedCount: "선택됨",
      batchStylesInfo: "여러 스타일을 선택하여 배치로 변형을 생성하세요",
      // History
      generationHistory: "생성 히스토리",
      noGenerationsYet: "생성된 영상이 없습니다",
      startGeneratingHint: "왼쪽 폼으로 영상 생성을 시작하세요",
      scoreAll: "전체 채점",
      scoring: "채점 중...",
      overall: "전체 점수",
      promptQuality: "프롬프트",
      technical: "기술",
      style: "스타일",
      trend: "트렌드",
      recommendations: "추천사항",
      viewVideo: "영상 보기",
      viewVideoWithAudio: "영상 보기 🎵",
      viewVideoNoAudio: "영상 보기 (음원 없음)",
      createVariation: "변형 생성",
      cancel: "취소",
      delete: "삭제",
      score: "점수",
      grade: "등급",
      audioSelection: "음원 선택",
      audioRequired: "음원을 선택해주세요. 영상 생성에는 음원이 필수입니다.",
      noAudioUploaded: "업로드된 음원이 없습니다",
      uploadAudioGuide: "위의 버튼을 클릭하여 음원을 업로드하세요",
      audioFormats: "MP3, WAV, AAC 지원 (최대 50MB)",
      audioSyncInfo: "영상 생성 시 선택한 음원의 최적 15초 구간이 자동으로 합성됩니다.",
      showList: "목록 보기",
      uploadNewAudio: "+ 새 음원 업로드",
      referenceSource: "참조 소스 (선택)",
      goods: "굿즈",
      selectedGoods: "선택된 굿즈",
      searchGoods: "굿즈 검색...",
      goodsNotFound: "굿즈를 찾을 수 없습니다",
      maxGoodsMessage: "최대 {max}개까지 선택 가능. AI가 선택한 굿즈를 영상에 포함합니다.",
      imageGuideGeneration: "이미지 가이드 비디오 생성",
      imageBasedGenerating: "이미지 기반 생성 중...",
      bridgePromptLoaded: "The Bridge에서 프롬프트를 가져왔습니다",
      bridgePromptMessage: "최적화된 프롬프트와 설정이 자동으로 적용되었습니다. 바로 Generate 버튼을 클릭하세요!",
      watchVideo: "영상 보기 🎵",
      watchVideoNoAudio: "영상 보기 (음원 없음)",
      imageReference: "이미지 참조",
      imageReferenceOptional: "이미지 참조 (선택)",
      imageReferenceDescription: "이미지를 선택하면 영상의 시작점이나 스타일 참조로 활용됩니다",
      selectFromAssetLocker: "Asset Locker에서 이미지 선택",
      i2vModeInfo: "이미지를 선택하면 Image-to-Video (I2V) 모드로 생성됩니다. 선택하지 않으면 텍스트만으로 생성합니다.",
      imageUsageDescription: "이미지 활용 방법",
      imageUsageRequired: "이미지를 영상에서 어떻게 활용할지 설명해주세요",
      imageUsagePlaceholder: "예: 이 앨범 커버가 화면 중앙에서 3D로 회전하면서 주변에 빛이 퍼져나가는 효과를 넣어줘...",
      changeImage: "다른 이미지",
      quickSelect: "빠른 선택",
      suggestion1: "이 이미지가 화면 중앙에서 3D로 회전하며 빛이 퍼지는 효과",
      suggestion2: "이 이미지로 시작해서 점점 줌아웃되며 전체 장면이 드러남",
      suggestion3: "이 이미지의 인물이 움직이기 시작하며 카메라가 따라감",
      suggestion4: "이 이미지가 물결처럼 흔들리며 몽환적인 분위기로 전환",
      suggestion5: "이 제품이 360도 회전하며 하이라이트가 반짝임",
      // Variations
      createVariations: "변형 생성",
      variationModalTitle: "변형 생성",
      variationModalDescription: "테스트 영상을 기반으로 다양한 스타일의 영상을 자동 생성합니다",
      fixedSettings: "고정 설정 (Seed Generation)",
      styleVariationCategories: "스타일 변형 카테고리",
      aiPromptVariations: "프롬프트 자동 변형 (AI)",
      promptVariationDescription: "핵심 의미는 유지하면서 다양한 표현으로 변형합니다",
      cameraAngles: "카메라 앵글",
      expressions: "표현 변형",
      maxVariations: "최대 생성 수",
      maxVariationsDescription: "비용 관리를 위해 최대 생성 수를 제한합니다",
      estimatedVariations: "예상 생성 수",
      selectCategories: "카테고리를 선택해주세요",
      generateVariations: "변형 생성",
      creatingVariations: "생성 중...",
      variationCostWarning: "개의 영상이 생성됩니다. 비용이 많이 발생할 수 있습니다.",
    },
    pipeline: {
      title: "파이프라인 관리",
      description: "변형 생성 작업을 모니터링하고 관리합니다",
      noPipelines: "파이프라인이 없습니다",
      noPipelinesDescription: "Generate 페이지에서 영상을 생성한 후 '변형 생성' 버튼을 눌러 파이프라인을 시작하세요",
      goToGenerate: "Generate 페이지로 이동",
      newVariation: "새 변형 생성",
      refresh: "새로고침",
      totalPipelines: "전체 파이프라인",
      processing: "처리중",
      completed: "완료",
      partialFailure: "일부 실패",
      pending: "대기중",
      viewDetails: "상세보기",
      toCuration: "큐레이션으로",
      pause: "일시정지",
      delete: "삭제",
      variations: "변형",
      seedVideo: "시드 영상 (원본)",
      pipelineDetail: "파이프라인 상세",
      progress: "진행률",
      selectCompleted: "완료된 항목 선택",
      deselectAll: "선택 해제",
      searchPlaceholder: "프롬프트 또는 카테고리 검색...",
    },
    curation: {
      title: "큐레이션",
      mosaicView: "모자이크 뷰",
      compare: "비교",
      approve: "승인",
      refine: "수정",
      delete: "삭제",
      selectForComparison: "비교할 영상 선택",
      scoreAll: "전체 점수 계산",
      filterByStatus: "상태별 필터",
      filterByScore: "점수별 필터",
      sortBy: "정렬",
      caption: "캡션",
      generateCaption: "캡션 생성",
    },
    publishing: {
      title: "발행 스케줄",
      schedule: "스케줄",
      accounts: "연결된 계정",
      connectAccount: "계정 연결",
      selectPlatform: "플랫폼 선택",
      selectVideo: "영상 선택",
      caption: "캡션",
      hashtags: "해시태그",
      scheduledTime: "예약 시간",
      timezone: "시간대",
      status: {
        draft: "초안",
        scheduled: "예약됨",
        publishing: "발행 중",
        published: "발행됨",
        failed: "실패",
        cancelled: "취소됨",
      },
      platforms: {
        tiktok: "틱톡",
        youtube: "유튜브",
        instagram: "인스타그램",
        twitter: "트위터",
      },
    },
    errors: {
      general: "오류가 발생했습니다",
      networkError: "네트워크 오류",
      unauthorized: "인증이 필요합니다",
      forbidden: "접근 권한이 없습니다",
      notFound: "찾을 수 없습니다",
      validation: "입력 값을 확인해주세요",
      serverError: "서버 오류가 발생했습니다",
      tryAgain: "다시 시도해주세요",
    },
    createPage: {
      title: "만들기",
      subtitle: "AI로 영상을 생성하세요",
      modes: {
        quick: {
          name: "빠른 생성",
          description: "프롬프트만으로 빠르게 영상 생성",
        },
        generate: {
          name: "고급 생성",
          description: "세부 설정과 참조 이미지로 영상 생성",
        },
        compose: {
          name: "컴포즈",
          description: "이미지와 음악으로 슬라이드쇼 영상 제작",
        },
        batch: {
          name: "배치",
          description: "여러 프롬프트로 대량 영상 생성",
        },
      },
      hints: {
        quickModeInfo: "기본 설정: 9:16 세로, 5-10초 길이, AI 자동 최적화",
        needMoreControl: "더 세밀한 설정이 필요하신가요?",
      },
    },
    campaignWorkspace: {
      tabs: {
        assets: "에셋",
        create: "만들기",
        generate: "생성",
        compose: "컴포즈",
        videos: "영상",
        publish: "발행",
        analytics: "분석",
        info: "정보",
      },
    },
    workspace: {
      // Stats
      generated: "생성됨",
      highQuality: "고품질",
      published: "발행됨",
      prompts: "프롬프트",
      totalViews: "총 조회수",
      totalLikes: "총 좋아요",
      // Tabs
      timeline: "타임라인",
      promptLibrary: "프롬프트 라이브러리",
      references: "참조",
      gallery: "갤러리",
      publishing: "발행",
      // Timeline
      workHistory: "작업 히스토리",
      chronologicalView: "시간순 활동 보기",
      noActivityYet: "활동 내역이 없습니다",
      startGenerating: "생성 시작",
      videoGeneration: "영상 생성",
      // Prompts
      allPromptsUsed: "이 캠페인에서 사용된 모든 프롬프트",
      clickToReuse: "클릭하여 재사용",
      noPromptsYet: "프롬프트가 없습니다",
      viewOptimizedPrompt: "최적화된 프롬프트 보기",
      used: "사용",
      success: "성공",
      avg: "평균",
      last: "최근",
      copyPrompt: "프롬프트 복사",
      reuse: "재사용",
      // References
      trendsUsed: "사용된 트렌드",
      keywordsApplied: "생성에 적용된 키워드와 해시태그",
      noTrendsUsed: "사용된 트렌드가 없습니다",
      successful: "성공",
      referenceUrls: "참조 URL",
      externalLinks: "참조로 사용된 외부 링크",
      noReferenceUrls: "참조 URL이 없습니다",
      // Gallery
      generatedVideos: "생성된 영상",
      allVideosGenerated: "이 캠페인에서 생성된 모든 영상",
      searchPrompts: "프롬프트 검색...",
      allStatus: "전체 상태",
      noVideosFound: "영상을 찾을 수 없습니다",
      // Publishing
      publishedContent: "발행된 콘텐츠",
      snsStatus: "SNS 발행 상태 및 성과",
      noPublishedContent: "발행된 콘텐츠가 없습니다",
      publishContent: "콘텐츠 발행",
      // Video Modal
      videoPreview: "영상 미리보기",
      details: "상세",
      duration: "길이",
      aspectRatio: "비율",
      created: "생성일",
      status: "상태",
      trendsApplied: "적용된 트렌드",
      referenceImage: "참조 이미지",
      merchandise: "굿즈",
      generateSimilar: "유사하게 생성",
      withAudio: "오디오 포함",
      loading: "워크스페이스 로딩 중...",
      loadError: "워크스페이스 로드 실패",
      tryAgain: "다시 시도",
    },
    publish: {
      // Page header
      title: "발행 관리",
      manageSchedule: "예약된 게시물을 관리하세요",
      // Stats
      total: "전체",
      publishing: "발행 중",
      scheduled: "예약됨",
      published: "발행됨",
      drafts: "초안",
      failed: "실패",
      cancelled: "취소됨",
      // View tabs
      queue: "대기열",
      list: "목록",
      calendar: "캘린더",
      allPlatforms: "전체 플랫폼",
      // Connected
      connected: "연결됨",
      noAccountsConnected: "연결된 계정 없음",
      // Empty state
      noScheduledPosts: "예약된 게시물이 없습니다",
      connectAccountsMessage: "SNS 계정을 연결하여 발행을 시작하세요",
      generateVideosFirst: "먼저 영상을 생성한 후 발행 예약하세요",
      scheduleFirstPost: "첫 게시물 예약하기",
      contactAdmin: "관리자에게 연락하여 SNS 계정을 연결하세요",
      generateVideos: "영상 생성",
      // Post sections
      publishingPosts: "발행 중",
      scheduledPosts: "예약됨",
      draftPosts: "초안",
      publishedPosts: "발행됨",
      failedPosts: "실패",
      cancelledPosts: "취소됨",
      // Post card
      noCaption: "캡션 없음",
      cancelPost: "이 예약 게시물을 취소하시겠습니까?",
      deletePost: "이 게시물을 삭제하시겠습니까?",
      viewPost: "게시물 보기",
      inTime: "후",
      error: "오류",
      retry: "재시도",
      thumbnailExpired: "썸네일 만료됨",
      noThumbnail: "미리보기 없음",
      // Schedule modal
      schedulePost: "게시물 예약",
      selectVideo: "영상 선택",
      publishTo: "발행 대상",
      caption: "캡션",
      scheduleTime: "예약 시간 (선택)",
      leaveEmptyForDraft: "비워두면 초안으로 저장됩니다",
      cancel: "취소",
      scheduling: "예약 중...",
      saveAsDraft: "초안으로 저장",
      // Calendar view
      calendarView: "캘린더 뷰",
      comingSoon: "캘린더 뷰가 곧 제공됩니다. 대기열 또는 목록 뷰를 이용하세요.",
      writeCaption: "캡션을 작성하세요...",
    },
    compose: {
      title: "슬라이드쇼 영상 제작",
      subtitle: "AI가 생성한 스크립트와 이미지로 비트 싱크 영상을 만들어보세요",
      step1: "Step 1",
      step2: "Step 2",
      step3: "Step 3",
      step4: "Step 4",
      stepScript: "스크립트 생성",
      stepImages: "이미지 선택",
      stepMusic: "음악 매칭",
      stepRender: "렌더링",
      scriptGeneration: "AI 스크립트 생성",
      enterPrompt: "영상 컨셉을 입력하세요",
      promptPlaceholder: "예: 정국의 새 앨범 발매를 기념하는 감성적인 팬 비디오...",
      selectDuration: "영상 길이 선택",
      selectAspectRatio: "화면 비율 선택",
      generateScript: "스크립트 생성",
      generatingScript: "AI가 스크립트를 생성 중...",
      scriptPreview: "스크립트 미리보기",
      vibeAnalysis: "분위기 분석",
      suggestedBpm: "추천 BPM",
      searchKeywords: "이미지 검색 키워드",
      effectRecommendation: "추천 효과",
      totalDuration: "총 길이",
      editScript: "스크립트 편집",
      imageSearch: "Google 이미지 검색",
      searchingImages: "이미지 검색 중...",
      searchResults: "검색 결과",
      selectImages: "사용할 이미지를 선택하세요",
      selectedImages: "선택된 이미지",
      minImagesRequired: "최소 3개 이상의 이미지가 필요합니다",
      maxImagesAllowed: "최대 10개까지 선택 가능합니다",
      uploadOwnImages: "직접 이미지 업로드",
      dragDropImages: "이미지를 드래그하거나 클릭하여 업로드",
      imageQuality: "품질 점수",
      noImagesFound: "이미지를 찾을 수 없습니다",
      searchAgain: "다시 검색",
      musicMatching: "음악 매칭",
      matchingMusic: "분위기에 맞는 음악 찾는 중...",
      matchedTracks: "매칭된 음악",
      selectTrack: "음악 선택",
      bpm: "BPM",
      energy: "에너지",
      matchScore: "매칭 점수",
      previewTrack: "미리 듣기",
      noTracksFound: "매칭되는 음악이 없습니다. Asset Locker에 음악을 업로드해주세요.",
      uploadMusic: "음악 업로드",
      analyzingAudio: "오디오 분석 중...",
      renderVideo: "영상 렌더링",
      renderSettings: "렌더링 설정",
      effectPreset: "효과 프리셋",
      textStyle: "텍스트 스타일",
      colorGrade: "색 보정",
      startRender: "렌더링 시작",
      renderProgress: "렌더링 진행 중",
      renderComplete: "렌더링 완료!",
      renderFailed: "렌더링 실패",
      downloadVideo: "영상 다운로드",
      renderStep: "현재 단계",
      estimatedTime: "예상 소요 시간",
      vibeExciting: "신나는",
      vibeEmotional: "감성적인",
      vibePop: "팝",
      vibeMinimal: "미니멀",
      back: "이전",
      next: "다음",
      finish: "완료",
      reset: "처음부터",
      retry: "다시 시도",
    },
  },
  en: {
    common: {
      loading: "Loading...",
      error: "Error",
      success: "Success",
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      create: "Create",
      search: "Search",
      filter: "Filter",
      all: "All",
      none: "None",
      confirm: "Confirm",
      back: "Back",
      next: "Next",
      previous: "Previous",
      submit: "Submit",
      close: "Close",
      view: "View",
      more: "More",
      logout: "Logout",
      remove: "Remove",
      selected: "Selected",
      upload: "Upload",
      uploading: "Uploading...",
      selectFile: "Select File",
      preview: "Preview",
      noData: "No data available",
      image: "Image",
      video: "Video",
      audio: "Audio",
      views: "views",
      uploadSuccess: "Upload complete",
      uploadFailed: "Upload failed",
      fileSizeLimit: "File size must be under {size}MB",
      fileTypeError: "Only {type} files are allowed",
      deleteConfirm: "Are you sure you want to delete?",
    },
    navigation: {
      dashboard: "Dashboard",
      bridge: "Bridge",
      campaigns: "Campaigns",
      assets: "Assets",
      trends: "Trends",
      publish: "Publish",
      settings: "Settings",
    },
    dashboard: {
      welcome: "Welcome back",
      welcomeMessage: "Ready to create amazing AI-generated videos?",
      totalCampaigns: "Total Campaigns",
      activeCampaigns: "Active",
      draftCampaigns: "Draft",
      recentCampaigns: "Recent Campaigns",
      newCampaign: "New Campaign",
      noCampaigns: "No campaigns yet",
      createFirst: "Create your first campaign to get started",
      viewAll: "View all",
      role: "Role",
    },
    bridge: {
      title: "The Bridge",
      subtitle: "Transform your ideas into viral videos",
      trendRadar: "Trend Radar",
      realTimeTrends: "Real-time trends",
      promptAlchemist: "Prompt Alchemist",
      selectCampaign: "Select campaign...",
      enterIdea: "Enter your idea",
      ideaPlaceholder: "e.g., Jungkook dancing in the rain",
      transform: "Transform Prompt",
      transforming: "Transforming...",
      optimizedPrompt: "Optimized Veo Prompt",
      analysis: "Analysis",
      generateVideo: "Generate Video",
      recentVideos: "Recent Videos",
      noVideos: "No videos generated yet",
      maxTrends: "Maximum 3",
      maxTrendsMessage: "You can select up to 3 trend keywords",
      transformSuccess: "Transform Complete",
      transformSuccessMessage: "Prompt has been successfully optimized",
      safetyFailed: "Safety Check Failed",
      errorOccurred: "An error occurred during prompt transformation",
      appliedTrends: "Applied trends",
      assetLocker: "Asset Locker",
      tiktokStyleAnalysis: "TikTok Style Analysis",
      enterTiktokUrl: "Enter TikTok URL",
      tiktokUrlPlaceholder: "Paste TikTok video URL...",
      invalidTiktokUrl: "Invalid TikTok URL",
      analysisFailed: "Analysis Failed",
      analysisComplete: "Analysis Complete",
      videoStyleAnalyzed: "Video style has been successfully analyzed",
      noPromptGenerated: "No Prompt",
      promptApplied: "Prompt Applied",
      analysisApplied: "Analysis has been applied to the prompt",
      styleAnalysis: "Style Analysis",
      mood: "Mood",
      pace: "Pace",
      recommendation: "Recommendation",
      generatedPrompt: "Generated Prompt",
      generateWithStyle: "Generate prompt with this style",
      fetchFromUrl: "Fetch trends from URL",
      campaignAssets: "{name}'s assets",
      selectCampaignFirst: "Select a campaign first",
      noAssets: "No assets available",
      uploadAssets: "Upload assets",
      campaignDetailPage: "Campaign Detail Page",
      hashtagsExtracted: "Hashtags Extracted",
      hashtagsExtractedMessage: "{count} hashtags have been imported",
      promptTransferred: "Prompt Transferred",
      navigateToGenerate: "Navigating to Generate page",
      celebrityDetected: "Celebrity Name Detected",
      celebrityWarningMessage: "{names} name(s) detected and automatically replaced with generic descriptions. Google Veo cannot generate videos of real people.",
      aspectRatioLabel: "Ratio",
      fpsLabel: "FPS",
      durationLabel: "Duration",
      viewAllVideos: "View all videos",
    },
    campaigns: {
      title: "Campaigns",
      create: "Create Campaign",
      edit: "Edit Campaign",
      delete: "Delete Campaign",
      name: "Name",
      description: "Description",
      artist: "Artist",
      status: "Status",
      startDate: "Start Date",
      endDate: "End Date",
      targetCountries: "Target Countries",
      createdAt: "Created At",
      assets: "Assets",
      generations: "Generations",
      generate: "Generate",
      curation: "Curation",
      publish: "Publish",
      statuses: {
        draft: "Draft",
        active: "Active",
        completed: "Completed",
        archived: "Archived",
      },
    },
    generation: {
      title: "Video Generation",
      prompt: "Prompt",
      negativePrompt: "Negative Prompt",
      duration: "Duration",
      aspectRatio: "Aspect Ratio",
      referenceImage: "Reference Image",
      stylePreset: "Style Preset",
      generate: "Generate",
      generating: "Generating...",
      batch: "Batch",
      batchGenerate: "Batch Generate",
      selectPresets: "Select Presets",
      status: {
        pending: "Pending",
        processing: "Processing",
        completed: "Completed",
        failed: "Failed",
        cancelled: "Cancelled",
      },
      stats: {
        total: "Total",
        pending: "Pending",
        processing: "Processing",
        completed: "Completed",
        failed: "Failed",
      },
      // Trending
      trendingNow: "Trending Now",
      trendingDescription: "Click a trend to use it as your prompt inspiration",
      noTrendsFound: "No trends found for this platform",
      // Form
      newGeneration: "New Generation",
      promptRequired: "Please enter a prompt",
      promptPlaceholder: "Describe the video you want to generate...",
      promptTip: "Tip: Write in Korean or English. The AI will optimize it.",
      optimizing: "Optimizing...",
      optimizeWithAI: "Optimize with AI",
      promptOptimized: "Prompt Optimized",
      viewOptimizedPrompt: "View optimized prompt",
      negativePromptPlaceholder: "What to avoid in the video...",
      durationAutoCalc: "Duration is auto-calculated (10-30s based on vibe)",
      stylePresets: "Style Presets",
      clearAll: "Clear all",
      selectedCount: "selected",
      batchStylesInfo: "Select multiple styles to generate variations in batch",
      // History
      generationHistory: "Generation History",
      noGenerationsYet: "No generations yet",
      startGeneratingHint: "Start generating videos with the form on the left",
      scoreAll: "Score All",
      scoring: "Scoring...",
      overall: "Overall Score",
      promptQuality: "Prompt",
      technical: "Technical",
      style: "Style",
      trend: "Trend",
      recommendations: "Recommendations",
      viewVideo: "Watch Video",
      viewVideoWithAudio: "Watch Video 🎵",
      viewVideoNoAudio: "Watch Video (No Audio)",
      createVariation: "Create Variations",
      cancel: "Cancel",
      delete: "Delete",
      score: "Score",
      grade: "Grade",
      audioSelection: "Audio Selection",
      audioRequired: "Please select an audio track. Audio is required for video generation.",
      noAudioUploaded: "No audio tracks uploaded",
      uploadAudioGuide: "Click the button above to upload an audio track",
      audioFormats: "MP3, WAV, AAC supported (max 50MB)",
      audioSyncInfo: "The optimal 15-second segment of the selected audio will be automatically synced with the video.",
      showList: "Show List",
      uploadNewAudio: "+ Upload New Audio",
      referenceSource: "Reference Source (Optional)",
      goods: "Merchandise",
      selectedGoods: "Selected Merchandise",
      searchGoods: "Search merchandise...",
      goodsNotFound: "No merchandise found",
      maxGoodsMessage: "Up to {max} items can be selected. AI will include selected merchandise in the video.",
      imageGuideGeneration: "Image-Guided Video Generation",
      imageBasedGenerating: "Generating from image...",
      bridgePromptLoaded: "Prompt loaded from The Bridge",
      bridgePromptMessage: "Optimized prompt and settings have been automatically applied. Click Generate to start!",
      watchVideo: "Watch Video 🎵",
      watchVideoNoAudio: "Watch Video (No Audio)",
      imageReference: "Image Reference",
      imageReferenceOptional: "Image Reference (Optional)",
      imageReferenceDescription: "Selected image will be used as a starting point or style reference for the video",
      selectFromAssetLocker: "Select from Asset Locker",
      i2vModeInfo: "Selecting an image enables Image-to-Video (I2V) mode. Without an image, text-only generation will be used.",
      imageUsageDescription: "Image Usage Description",
      imageUsageRequired: "Please describe how to use this image in the video",
      imageUsagePlaceholder: "e.g., This album cover rotates in 3D at the center of the screen with light rays emanating from it...",
      changeImage: "Change Image",
      quickSelect: "Quick Select",
      suggestion1: "This image rotates in 3D at the center with light spreading effect",
      suggestion2: "Start with this image and gradually zoom out to reveal the full scene",
      suggestion3: "The person in this image starts moving as the camera follows",
      suggestion4: "This image ripples like water transitioning to a dreamy atmosphere",
      suggestion5: "This product rotates 360 degrees with highlights sparkling",
      // Variations
      createVariations: "Create Variations",
      variationModalTitle: "Create Variations",
      variationModalDescription: "Automatically generate videos with various styles based on your test video",
      fixedSettings: "Fixed Settings (Seed Generation)",
      styleVariationCategories: "Style Variation Categories",
      aiPromptVariations: "AI Prompt Variations",
      promptVariationDescription: "Varies expressions while maintaining core meaning",
      cameraAngles: "Camera Angles",
      expressions: "Expressions",
      maxVariations: "Maximum Variations",
      maxVariationsDescription: "Limit maximum variations for cost management",
      estimatedVariations: "Estimated Variations",
      selectCategories: "Please select categories",
      generateVariations: "Generate Variations",
      creatingVariations: "Creating...",
      variationCostWarning: "videos will be generated. This may incur significant costs.",
    },
    pipeline: {
      title: "Pipeline Management",
      description: "Monitor and manage variation generation jobs",
      noPipelines: "No Pipelines Yet",
      noPipelinesDescription: "Create a video on the Generate page and click 'Create Variations' to start a pipeline",
      goToGenerate: "Go to Generate Page",
      newVariation: "New Variation",
      refresh: "Refresh",
      totalPipelines: "Total Pipelines",
      processing: "Processing",
      completed: "Completed",
      partialFailure: "Partial Failure",
      pending: "Pending",
      viewDetails: "View Details",
      toCuration: "To Curation",
      pause: "Pause",
      delete: "Delete",
      variations: "variations",
      seedVideo: "Seed Video (Original)",
      pipelineDetail: "Pipeline Detail",
      progress: "Progress",
      selectCompleted: "Select Completed",
      deselectAll: "Deselect All",
      searchPlaceholder: "Search prompts or categories...",
    },
    curation: {
      title: "Curation",
      mosaicView: "Mosaic View",
      compare: "Compare",
      approve: "Approve",
      refine: "Refine",
      delete: "Delete",
      selectForComparison: "Select videos to compare",
      scoreAll: "Score All",
      filterByStatus: "Filter by Status",
      filterByScore: "Filter by Score",
      sortBy: "Sort by",
      caption: "Caption",
      generateCaption: "Generate Caption",
    },
    publishing: {
      title: "Publishing Schedule",
      schedule: "Schedule",
      accounts: "Connected Accounts",
      connectAccount: "Connect Account",
      selectPlatform: "Select Platform",
      selectVideo: "Select Video",
      caption: "Caption",
      hashtags: "Hashtags",
      scheduledTime: "Scheduled Time",
      timezone: "Timezone",
      status: {
        draft: "Draft",
        scheduled: "Scheduled",
        publishing: "Publishing",
        published: "Published",
        failed: "Failed",
        cancelled: "Cancelled",
      },
      platforms: {
        tiktok: "TikTok",
        youtube: "YouTube",
        instagram: "Instagram",
        twitter: "Twitter",
      },
    },
    errors: {
      general: "An error occurred",
      networkError: "Network error",
      unauthorized: "Authentication required",
      forbidden: "Access denied",
      notFound: "Not found",
      validation: "Please check your input",
      serverError: "Server error occurred",
      tryAgain: "Please try again",
    },
    createPage: {
      title: "Create",
      subtitle: "Generate videos with AI",
      modes: {
        quick: {
          name: "Quick",
          description: "Generate videos quickly with just a prompt",
        },
        generate: {
          name: "Advanced",
          description: "Generate videos with detailed settings and reference images",
        },
        compose: {
          name: "Compose",
          description: "Create slideshow videos with images and music",
        },
        batch: {
          name: "Batch",
          description: "Generate multiple videos with batch prompts",
        },
      },
      hints: {
        quickModeInfo: "Defaults: 9:16 vertical, 5-10 seconds, AI auto-optimization",
        needMoreControl: "Need more control?",
      },
    },
    campaignWorkspace: {
      tabs: {
        assets: "Assets",
        create: "Create",
        generate: "Generate",
        compose: "Compose",
        videos: "Videos",
        publish: "Publish",
        analytics: "Analytics",
        info: "Info",
      },
    },
    workspace: {
      // Stats
      generated: "Generated",
      highQuality: "High Quality",
      published: "Published",
      prompts: "Prompts",
      totalViews: "Total Views",
      totalLikes: "Total Likes",
      // Tabs
      timeline: "Timeline",
      promptLibrary: "Prompt Library",
      references: "References",
      gallery: "Gallery",
      publishing: "Publishing",
      // Timeline
      workHistory: "Work History",
      chronologicalView: "Chronological view of all activities",
      noActivityYet: "No activity yet",
      startGenerating: "Start Generating",
      videoGeneration: "Video Generation",
      // Prompts
      allPromptsUsed: "All prompts used in this campaign",
      clickToReuse: "Click to reuse",
      noPromptsYet: "No prompts yet",
      viewOptimizedPrompt: "View optimized prompt",
      used: "Used",
      success: "success",
      avg: "Avg",
      last: "Last",
      copyPrompt: "Copy Prompt",
      reuse: "Reuse",
      // References
      trendsUsed: "Trends Used",
      keywordsApplied: "Keywords and hashtags applied to generations",
      noTrendsUsed: "No trends used yet",
      successful: "successful",
      referenceUrls: "Reference URLs",
      externalLinks: "External links used as reference",
      noReferenceUrls: "No reference URLs yet",
      // Gallery
      generatedVideos: "Generated Videos",
      allVideosGenerated: "All videos generated for this campaign",
      searchPrompts: "Search prompts...",
      allStatus: "All Status",
      noVideosFound: "No videos found",
      // Publishing
      publishedContent: "Published Content",
      snsStatus: "SNS publishing status and performance",
      noPublishedContent: "No published content yet",
      publishContent: "Publish Content",
      // Video Modal
      videoPreview: "Video Preview",
      details: "Details",
      duration: "Duration",
      aspectRatio: "Aspect Ratio",
      created: "Created",
      status: "Status",
      trendsApplied: "Trends Applied",
      referenceImage: "Reference Image",
      merchandise: "Merchandise",
      generateSimilar: "Generate Similar",
      withAudio: "With Audio",
      loading: "Loading workspace...",
      loadError: "Failed to load workspace",
      tryAgain: "Try Again",
    },
    publish: {
      // Page header
      title: "Publishing",
      manageSchedule: "Manage your scheduled posts",
      // Stats
      total: "Total",
      publishing: "Publishing",
      scheduled: "Scheduled",
      published: "Published",
      drafts: "Drafts",
      failed: "Failed",
      cancelled: "Cancelled",
      // View tabs
      queue: "Queue",
      list: "List",
      calendar: "Calendar",
      allPlatforms: "All Platforms",
      // Connected
      connected: "Connected",
      noAccountsConnected: "No accounts connected",
      // Empty state
      noScheduledPosts: "No scheduled posts yet",
      connectAccountsMessage: "Connect your social media accounts to start publishing",
      generateVideosFirst: "Generate some videos first, then schedule them for publishing",
      scheduleFirstPost: "Schedule Your First Post",
      contactAdmin: "Contact your administrator to connect social media accounts",
      generateVideos: "Generate Videos",
      // Post sections
      publishingPosts: "Publishing",
      scheduledPosts: "Scheduled",
      draftPosts: "Drafts",
      publishedPosts: "Published",
      failedPosts: "Failed",
      cancelledPosts: "Cancelled",
      // Post card
      noCaption: "No caption",
      cancelPost: "Cancel this scheduled post?",
      deletePost: "Delete this scheduled post?",
      viewPost: "View Post",
      inTime: "in",
      error: "Error",
      retry: "Retry",
      thumbnailExpired: "Thumbnail expired",
      noThumbnail: "No preview",
      // Schedule modal
      schedulePost: "Schedule Post",
      selectVideo: "Select Video",
      publishTo: "Publish To",
      caption: "Caption",
      scheduleTime: "Schedule Time (Optional)",
      leaveEmptyForDraft: "Leave empty to save as draft",
      cancel: "Cancel",
      scheduling: "Scheduling...",
      saveAsDraft: "Save as Draft",
      // Calendar view
      calendarView: "Calendar View",
      comingSoon: "Calendar view coming soon. Use Queue or List view for now.",
      writeCaption: "Write your caption...",
    },
    compose: {
      title: "Slideshow Video Creator",
      subtitle: "Create beat-synced videos with AI-generated scripts and images",
      step1: "Step 1",
      step2: "Step 2",
      step3: "Step 3",
      step4: "Step 4",
      stepScript: "Generate Script",
      stepImages: "Select Images",
      stepMusic: "Match Music",
      stepRender: "Render",
      scriptGeneration: "AI Script Generation",
      enterPrompt: "Enter video concept",
      promptPlaceholder: "e.g., An emotional fan video celebrating Jungkook's new album release...",
      selectDuration: "Select duration",
      selectAspectRatio: "Select aspect ratio",
      generateScript: "Generate Script",
      generatingScript: "AI is generating script...",
      scriptPreview: "Script Preview",
      vibeAnalysis: "Vibe Analysis",
      suggestedBpm: "Suggested BPM",
      searchKeywords: "Image Search Keywords",
      effectRecommendation: "Effect Recommendation",
      totalDuration: "Total Duration",
      editScript: "Edit Script",
      imageSearch: "Google Image Search",
      searchingImages: "Searching images...",
      searchResults: "Search Results",
      selectImages: "Select images to use",
      selectedImages: "Selected Images",
      minImagesRequired: "At least 3 images are required",
      maxImagesAllowed: "Maximum 10 images allowed",
      uploadOwnImages: "Upload your own images",
      dragDropImages: "Drag and drop or click to upload",
      imageQuality: "Quality Score",
      noImagesFound: "No images found",
      searchAgain: "Search Again",
      musicMatching: "Music Matching",
      matchingMusic: "Finding music that matches the vibe...",
      matchedTracks: "Matched Tracks",
      selectTrack: "Select Track",
      bpm: "BPM",
      energy: "Energy",
      matchScore: "Match Score",
      previewTrack: "Preview",
      noTracksFound: "No matching tracks found. Please upload music to Asset Locker.",
      uploadMusic: "Upload Music",
      analyzingAudio: "Analyzing audio...",
      renderVideo: "Render Video",
      renderSettings: "Render Settings",
      effectPreset: "Effect Preset",
      textStyle: "Text Style",
      colorGrade: "Color Grade",
      startRender: "Start Render",
      renderProgress: "Rendering in Progress",
      renderComplete: "Render Complete!",
      renderFailed: "Render Failed",
      downloadVideo: "Download Video",
      renderStep: "Current Step",
      estimatedTime: "Estimated Time",
      vibeExciting: "Exciting",
      vibeEmotional: "Emotional",
      vibePop: "Pop",
      vibeMinimal: "Minimal",
      back: "Back",
      next: "Next",
      finish: "Finish",
      reset: "Start Over",
      retry: "Retry",
    },
  },
};

// Get nested translation value
export function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let result: unknown = obj;

  for (const key of keys) {
    if (result && typeof result === "object" && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return path; // Return the path as fallback
    }
  }

  return typeof result === "string" ? result : path;
}
