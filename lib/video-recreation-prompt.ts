/**
 * Video Recreation Prompt Generator
 * Generates detailed prompts to recreate videos based on analyzed concept details
 */

import type { StartFromVideo } from "@/lib/stores/workflow-store";

export interface RecreationPromptResult {
  mainPrompt: string;
  visualPrompt: string;
  technicalPrompt: string;
  moodPrompt: string;
  fullPrompt: string;
  // Separated components for fine-tuning
  components: {
    subject: string;
    setting: string;
    style: string;
    lighting: string;
    camera: string;
    mood: string;
    pace: string;
    details: string;
  };
}

/**
 * Generate recreation prompt from video analysis
 */
export function generateRecreationPrompt(
  videoSource: StartFromVideo,
  options: {
    language?: "ko" | "en";
    includeHashtags?: boolean;
    emphasisLevel?: "subtle" | "exact" | "enhanced";
  } = {}
): RecreationPromptResult {
  const { language = "ko", includeHashtags = false, emphasisLevel = "exact" } = options;
  const conceptDetails = videoSource.aiAnalysis?.conceptDetails;
  const styleAnalysis = videoSource.aiAnalysis?.styleAnalysis;

  // Default values if analysis is missing
  const defaults = {
    visualStyle: "cinematic",
    colorPalette: ["neutral tones"],
    lighting: "natural lighting",
    cameraMovement: ["static"],
    transitions: ["cut"],
    effects: ["none"],
    mood: "engaging",
    pace: "moderate",
    mainSubject: "person",
    actions: ["speaking"],
    setting: "indoor",
    props: [],
    clothingStyle: "casual",
  };

  // Extract with defaults
  const visual = {
    style: conceptDetails?.visualStyle || defaults.visualStyle,
    colors: conceptDetails?.colorPalette || defaults.colorPalette,
    lighting: conceptDetails?.lighting || defaults.lighting,
  };

  const technical = {
    camera: conceptDetails?.cameraMovement || defaults.cameraMovement,
    transitions: conceptDetails?.transitions || defaults.transitions,
    effects: conceptDetails?.effects || defaults.effects,
  };

  const content = {
    subject: conceptDetails?.mainSubject || defaults.mainSubject,
    actions: conceptDetails?.actions || defaults.actions,
    setting: conceptDetails?.setting || defaults.setting,
    props: conceptDetails?.props || defaults.props,
    clothing: conceptDetails?.clothingStyle || defaults.clothingStyle,
  };

  const atmosphere = {
    mood: conceptDetails?.mood || defaults.mood,
    pace: conceptDetails?.pace || defaults.pace,
  };

  // Build component prompts
  const components = {
    subject: buildSubjectPrompt(content, language),
    setting: buildSettingPrompt(content, language),
    style: buildStylePrompt(visual, language),
    lighting: buildLightingPrompt(visual, language),
    camera: buildCameraPrompt(technical, language),
    mood: buildMoodPrompt(atmosphere, language),
    pace: buildPacePrompt(atmosphere, language),
    details: buildDetailsPrompt(content, technical, language),
  };

  // Build main prompts
  const visualPrompt = language === "ko"
    ? `${visual.style} 스타일, ${visual.colors.join(", ")} 색감, ${visual.lighting}`
    : `${visual.style} style, ${visual.colors.join(", ")} color palette, ${visual.lighting}`;

  const technicalPrompt = language === "ko"
    ? `카메라: ${technical.camera.join(", ")}, 전환: ${technical.transitions.join(", ")}, 효과: ${technical.effects.join(", ")}`
    : `Camera: ${technical.camera.join(", ")}, Transitions: ${technical.transitions.join(", ")}, Effects: ${technical.effects.join(", ")}`;

  const moodPrompt = language === "ko"
    ? `${atmosphere.mood} 분위기, ${atmosphere.pace} 템포`
    : `${atmosphere.mood} mood, ${atmosphere.pace} pace`;

  // Build main prompt based on emphasis level
  const mainPrompt = buildMainPrompt(content, visual, atmosphere, language, emphasisLevel);

  // Build full comprehensive prompt
  const fullPrompt = buildFullPrompt(
    videoSource,
    components,
    visualPrompt,
    technicalPrompt,
    moodPrompt,
    language,
    includeHashtags
  );

  return {
    mainPrompt,
    visualPrompt,
    technicalPrompt,
    moodPrompt,
    fullPrompt,
    components,
  };
}

function buildSubjectPrompt(
  content: { subject: string; clothing: string },
  language: "ko" | "en"
): string {
  if (language === "ko") {
    return `${content.clothing} 스타일의 ${content.subject}`;
  }
  return `${content.subject} wearing ${content.clothing}`;
}

function buildSettingPrompt(
  content: { setting: string; props: string[] },
  language: "ko" | "en"
): string {
  const propsText = content.props.length > 0 ? content.props.join(", ") : "";
  if (language === "ko") {
    return propsText
      ? `${content.setting} 배경, ${propsText} 소품 사용`
      : `${content.setting} 배경`;
  }
  return propsText
    ? `${content.setting} setting with ${propsText}`
    : `${content.setting} setting`;
}

function buildStylePrompt(
  visual: { style: string; colors: string[] },
  language: "ko" | "en"
): string {
  if (language === "ko") {
    return `${visual.style} 스타일, ${visual.colors.join("/")} 컬러 팔레트`;
  }
  return `${visual.style} style with ${visual.colors.join("/")} color palette`;
}

function buildLightingPrompt(
  visual: { lighting: string },
  language: "ko" | "en"
): string {
  if (language === "ko") {
    return `${visual.lighting} 조명`;
  }
  return `${visual.lighting} lighting`;
}

function buildCameraPrompt(
  technical: { camera: string[]; transitions: string[] },
  language: "ko" | "en"
): string {
  if (language === "ko") {
    return `${technical.camera.join(", ")} 카메라 움직임, ${technical.transitions.join(", ")} 전환`;
  }
  return `${technical.camera.join(", ")} camera movement, ${technical.transitions.join(", ")} transitions`;
}

function buildMoodPrompt(
  atmosphere: { mood: string },
  language: "ko" | "en"
): string {
  if (language === "ko") {
    return `${atmosphere.mood} 분위기`;
  }
  return `${atmosphere.mood} atmosphere`;
}

function buildPacePrompt(
  atmosphere: { pace: string },
  language: "ko" | "en"
): string {
  if (language === "ko") {
    return `${atmosphere.pace} 속도감`;
  }
  return `${atmosphere.pace} pacing`;
}

function buildDetailsPrompt(
  content: { actions: string[]; props: string[] },
  technical: { effects: string[] },
  language: "ko" | "en"
): string {
  const parts: string[] = [];

  if (content.actions.length > 0) {
    parts.push(language === "ko"
      ? `동작: ${content.actions.join(", ")}`
      : `Actions: ${content.actions.join(", ")}`
    );
  }

  if (technical.effects.length > 0 && technical.effects[0] !== "none") {
    parts.push(language === "ko"
      ? `효과: ${technical.effects.join(", ")}`
      : `Effects: ${technical.effects.join(", ")}`
    );
  }

  return parts.join("; ");
}

function buildMainPrompt(
  content: { subject: string; actions: string[]; setting: string; clothing: string },
  visual: { style: string; lighting: string },
  atmosphere: { mood: string; pace: string },
  language: "ko" | "en",
  emphasisLevel: "subtle" | "exact" | "enhanced"
): string {
  const actionText = content.actions.join(", ");

  if (language === "ko") {
    switch (emphasisLevel) {
      case "subtle":
        return `${content.setting}에서 ${content.subject}가 ${actionText}하는 ${atmosphere.mood} 영상`;
      case "exact":
        return `${visual.style} 스타일, ${content.clothing} 차림의 ${content.subject}가 ${content.setting}에서 ${actionText}. ${visual.lighting}, ${atmosphere.mood} 분위기, ${atmosphere.pace} 템포`;
      case "enhanced":
        return `[고품질 ${visual.style}] ${visual.lighting}이 비추는 ${content.setting}에서, ${content.clothing} 차림의 ${content.subject}가 ${actionText}. 매우 ${atmosphere.mood}한 분위기, ${atmosphere.pace} 템포로 시청자를 사로잡는 영상`;
    }
  } else {
    switch (emphasisLevel) {
      case "subtle":
        return `${content.subject} ${actionText} in ${content.setting}, ${atmosphere.mood} video`;
      case "exact":
        return `${visual.style} style, ${content.subject} wearing ${content.clothing} ${actionText} in ${content.setting}. ${visual.lighting}, ${atmosphere.mood} mood, ${atmosphere.pace} pace`;
      case "enhanced":
        return `[High quality ${visual.style}] In ${content.setting} with ${visual.lighting}, ${content.subject} wearing ${content.clothing} ${actionText}. Extremely ${atmosphere.mood} atmosphere, ${atmosphere.pace} pacing to captivate viewers`;
    }
  }
}

function buildFullPrompt(
  videoSource: StartFromVideo,
  components: RecreationPromptResult["components"],
  visualPrompt: string,
  technicalPrompt: string,
  moodPrompt: string,
  language: "ko" | "en",
  includeHashtags: boolean
): string {
  const conceptDetails = videoSource.aiAnalysis?.conceptDetails;
  const parts: string[] = [];

  if (language === "ko") {
    parts.push("=== 영상 재현 프롬프트 ===\n");

    parts.push("【메인 컨셉】");
    parts.push(`주제: ${components.subject}`);
    parts.push(`배경: ${components.setting}`);
    parts.push("");

    parts.push("【비주얼 스타일】");
    parts.push(visualPrompt);
    parts.push("");

    parts.push("【기술적 요소】");
    parts.push(technicalPrompt);
    parts.push("");

    parts.push("【분위기】");
    parts.push(moodPrompt);

    if (components.details) {
      parts.push("");
      parts.push("【세부 사항】");
      parts.push(components.details);
    }

    // Add original analysis reference if available
    if (videoSource.aiAnalysis?.styleAnalysis) {
      parts.push("");
      parts.push("【원본 스타일 분석】");
      parts.push(videoSource.aiAnalysis.styleAnalysis);
    }

    if (includeHashtags && videoSource.hashtags.length > 0) {
      parts.push("");
      parts.push("【참고 해시태그】");
      parts.push(videoSource.hashtags.join(" "));
    }
  } else {
    parts.push("=== Video Recreation Prompt ===\n");

    parts.push("【Main Concept】");
    parts.push(`Subject: ${components.subject}`);
    parts.push(`Setting: ${components.setting}`);
    parts.push("");

    parts.push("【Visual Style】");
    parts.push(visualPrompt);
    parts.push("");

    parts.push("【Technical Elements】");
    parts.push(technicalPrompt);
    parts.push("");

    parts.push("【Atmosphere】");
    parts.push(moodPrompt);

    if (components.details) {
      parts.push("");
      parts.push("【Details】");
      parts.push(components.details);
    }

    if (videoSource.aiAnalysis?.styleAnalysis) {
      parts.push("");
      parts.push("【Original Style Analysis】");
      parts.push(videoSource.aiAnalysis.styleAnalysis);
    }

    if (includeHashtags && videoSource.hashtags.length > 0) {
      parts.push("");
      parts.push("【Reference Hashtags】");
      parts.push(videoSource.hashtags.join(" "));
    }
  }

  return parts.join("\n");
}

/**
 * Generate a compact single-line prompt for direct AI use
 */
export function generateCompactPrompt(
  videoSource: StartFromVideo,
  language: "ko" | "en" = "ko"
): string {
  const result = generateRecreationPrompt(videoSource, { language, emphasisLevel: "exact" });
  return result.mainPrompt;
}

/**
 * Generate prompt specifically for image-to-video generation
 */
export function generateI2VPrompt(
  videoSource: StartFromVideo,
  language: "ko" | "en" = "ko"
): string {
  const conceptDetails = videoSource.aiAnalysis?.conceptDetails;

  const parts: string[] = [];

  // Focus on motion and action for I2V
  if (conceptDetails?.actions && conceptDetails.actions.length > 0) {
    parts.push(conceptDetails.actions.join(", "));
  }

  // Add camera movement
  if (conceptDetails?.cameraMovement && conceptDetails.cameraMovement.length > 0) {
    const camText = language === "ko"
      ? `${conceptDetails.cameraMovement.join(", ")} 카메라`
      : `${conceptDetails.cameraMovement.join(", ")} camera`;
    parts.push(camText);
  }

  // Add pace/tempo
  if (conceptDetails?.pace) {
    const paceText = language === "ko"
      ? `${conceptDetails.pace} 속도`
      : `${conceptDetails.pace} speed`;
    parts.push(paceText);
  }

  // Add mood
  if (conceptDetails?.mood) {
    const moodText = language === "ko"
      ? `${conceptDetails.mood} 분위기`
      : `${conceptDetails.mood} mood`;
    parts.push(moodText);
  }

  return parts.join(", ");
}

/**
 * Check if video source has enough data for recreation prompt
 */
export function hasRecreationData(videoSource: StartFromVideo | null): boolean {
  if (!videoSource) return false;
  if (!videoSource.aiAnalysis) return false;

  const cd = videoSource.aiAnalysis.conceptDetails;
  if (!cd) return false;

  // At least need some basic concept details
  return !!(cd.mainSubject || cd.visualStyle || cd.mood);
}
