/**
 * Image Prompt Combiner
 *
 * Combines main prompts with image reference descriptions for VEO I2V generation.
 * This utility ensures proper prompt structure for image-guided video generation.
 */

export interface CombinePromptInput {
  mainPrompt: string;           // Main prompt (or transformed veoPrompt)
  imageDescription: string;     // How to use the reference image
  negativePrompt?: string;
}

export interface CombinedPromptOutput {
  combinedPrompt: string;
  enhancedNegativePrompt: string;
}

/**
 * Combines main prompt with image reference description for I2V generation.
 *
 * @example
 * const result = combineWithImageReference({
 *   mainPrompt: "신비로운 분위기의 뮤직비디오 티저",
 *   imageDescription: "이 앨범 커버가 화면 중앙에서 3D로 회전하며 빛이 퍼지는 효과",
 *   negativePrompt: "blur, distortion"
 * });
 */
export function combineWithImageReference(
  input: CombinePromptInput
): CombinedPromptOutput {
  const { mainPrompt, imageDescription, negativePrompt } = input;

  // Build image instruction section
  // Translate Korean descriptions to English-style instructions for VEO
  const imageInstruction = buildImageInstruction(imageDescription);

  // Combine prompts with proper structure
  const combinedPrompt = [
    mainPrompt.trim(),
    imageInstruction,
  ].filter(Boolean).join(". ");

  // Enhance negative prompt with image-specific avoidances
  const enhancedNegativePrompt = buildEnhancedNegativePrompt(negativePrompt);

  return {
    combinedPrompt,
    enhancedNegativePrompt,
  };
}

/**
 * Builds the image instruction section for the prompt
 */
function buildImageInstruction(imageDescription: string): string {
  if (!imageDescription.trim()) {
    return "";
  }

  const description = imageDescription.trim();

  // Build structured instruction
  return `Starting from the reference image: ${description}. Maintain visual consistency with the reference image throughout the video. The reference image serves as the visual anchor and starting point`;
}

/**
 * Builds enhanced negative prompt for image-guided generation
 */
function buildEnhancedNegativePrompt(baseNegativePrompt?: string): string {
  const imageAvoidances = [
    "reference image distortion",
    "inconsistent with source image",
    "identity shift from reference",
    "color palette mismatch",
    "style inconsistency",
    "unrelated visual elements",
  ];

  const base = baseNegativePrompt?.trim() || "";
  const combined = base
    ? `${base}, ${imageAvoidances.join(", ")}`
    : imageAvoidances.join(", ");

  return combined;
}

/**
 * Validates if image description is sufficient for I2V generation
 */
export function validateImageDescription(description: string): {
  valid: boolean;
  message?: string;
} {
  const trimmed = description.trim();

  if (!trimmed) {
    return {
      valid: false,
      message: "이미지 활용 방법을 입력해주세요",
    };
  }

  if (trimmed.length < 10) {
    return {
      valid: false,
      message: "이미지 활용 방법을 좀 더 자세히 설명해주세요 (최소 10자)",
    };
  }

  if (trimmed.length > 500) {
    return {
      valid: false,
      message: "이미지 활용 방법이 너무 깁니다 (최대 500자)",
    };
  }

  return { valid: true };
}

/**
 * Suggests improvements for image descriptions
 */
export function suggestImageDescriptionImprovements(description: string): string[] {
  const suggestions: string[] = [];
  const trimmed = description.toLowerCase();

  // Check for movement/animation keywords
  const hasMovement = /움직|회전|이동|전환|나타|사라|줌|확대|축소|흔들|날|떠오|내려|올라/.test(trimmed);
  if (!hasMovement) {
    suggestions.push("움직임이나 애니메이션 효과를 추가해보세요 (예: 회전, 확대, 이동)");
  }

  // Check for positioning keywords
  const hasPosition = /중앙|위|아래|왼|오른|배경|전경|앞|뒤/.test(trimmed);
  if (!hasPosition) {
    suggestions.push("이미지의 위치나 레이아웃을 명시해보세요 (예: 화면 중앙에서)");
  }

  // Check for effect keywords
  const hasEffect = /빛|그림자|반짝|흐릿|선명|밝|어두|효과|필터/.test(trimmed);
  if (!hasEffect) {
    suggestions.push("시각적 효과를 추가해보세요 (예: 빛이 퍼지는, 반짝이는)");
  }

  return suggestions;
}
