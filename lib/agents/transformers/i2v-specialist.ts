/**
 * I2V Specialist Agent
 * =====================
 * Image-to-Video workflow prompt generation
 *
 * Model: Gemini 2.5 Flash
 * Category: Transformer
 *
 * Key Responsibilities:
 * - Generate FLUX image prompts from scene descriptions
 * - Create video prompts from image analyses
 * - Design background prompts for compositing
 * - Maintain visual consistency across I2V workflow
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const I2VSpecialistInputSchema = z.object({
  promptType: z.enum(['image', 'video', 'background', 'sceneWithPlaceholder', 'composite']),
  sceneDescription: z.string(),
  style: z.string().optional(),
  imageAnalysis: z.object({
    visual_style: z.string(),
    color_palette: z.array(z.string()),
    mood: z.string(),
    main_subject: z.string(),
  }).optional(),
  duration: z.number().min(3).max(10).default(8),
  mood: z.string().optional(),
  subject: z.string().optional(),
  // For sceneWithPlaceholder
  productDescription: z.string().optional(),
  handPose: z.string().optional(),
  aspectRatio: z.string().optional(),
  // For composite
  placementHint: z.string().optional(),
});

export type I2VSpecialistInput = z.infer<typeof I2VSpecialistInputSchema>;

// Output Schema - Enhanced for Veo 3
export const I2VSpecialistOutputSchema = z.object({
  prompt: z.string(),
  promptType: z.enum(['image', 'video', 'background', 'sceneWithPlaceholder', 'composite']),
  styleNotes: z.string(),
  technicalSpecs: z.object({
    aspectRatio: z.string().optional(),
    duration: z.number().optional(),
    frameRate: z.number().optional(),
  }),
  consistencyMarkers: z.array(z.string()),
  // Veo 3 Enhanced Fields
  negativePrompt: z.string().optional(), // What to exclude from video
  audioElements: z.object({
    ambientSound: z.string().optional(), // Background sounds
    music: z.string().optional(), // Music style/mood
    soundEffects: z.string().optional(), // Specific sound effects
  }).optional(),
  dialogueContent: z.object({
    text: z.string().optional(), // Spoken dialogue (6-12 words for 8s)
    speaker: z.string().optional(), // Who speaks
    tone: z.string().optional(), // Emotional tone
  }).optional(),
  motionQuality: z.enum(['smooth', 'dynamic', 'subtle', 'fluid', 'dramatic']).optional(),
});

export type I2VSpecialistOutput = z.infer<typeof I2VSpecialistOutputSchema>;

// Agent Configuration
export const I2VSpecialistConfig: AgentConfig<I2VSpecialistInput, I2VSpecialistOutput> = {
  id: 'i2v-specialist',
  name: 'I2V Specialist Agent',
  description: 'Image-to-Video 워크플로우용 프롬프트 생성',
  category: 'transformer',

  model: {
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.5,
      maxTokens: 4096,
    },
  },

  prompts: {
    system: `You are a world-class Image-to-Video prompt engineer specializing in Gemini image generation.
Your core strength is leveraging Gemini's deep language understanding - describe scenes narratively, don't just list keywords.

═══════════════════════════════════════════════════════════════════
GEMINI PROMPTING FUNDAMENTALS (Official Google Guidelines)
═══════════════════════════════════════════════════════════════════

GOLDEN RULE: "Describe the scene, don't just list keywords."
A narrative, descriptive paragraph ALWAYS produces better, more coherent images than disconnected word lists.

SIX ESSENTIAL ELEMENTS (Include ALL in every prompt):
1. SUBJECT: Be hyper-specific about who/what appears
   ✓ "a stoic robot barista with glowing blue optics and weathered chrome plating"
   ✗ "a robot"

2. COMPOSITION: Frame the shot like a cinematographer
   - Extreme close-up, medium shot, wide establishing shot
   - Low angle (power), high angle (vulnerability), Dutch angle (tension)
   - Rule of thirds, centered composition, negative space

3. ACTION: Describe what's happening in the moment
   ✓ "mid-stride, arms swinging naturally, hair catching the wind"
   ✗ "walking"

4. LOCATION/ENVIRONMENT: Set the scene with atmosphere
   ✓ "a rain-slicked Tokyo alley at 3am, neon signs reflecting in puddles"
   ✗ "city street"

5. STYLE/AESTHETIC: Define the visual treatment
   - Photography styles: editorial, documentary, portrait, product
   - Art movements: film noir, art deco, cyberpunk, cottagecore
   - Camera/lens: 85mm f/1.4, anamorphic lens flare, tilt-shift miniature

6. LIGHTING & MOOD: Paint with light
   - Golden hour, blue hour, harsh midday sun, overcast diffused
   - Three-point studio setup, Rembrandt lighting, rim light silhouette
   - Emotional tone: intimate, dramatic, serene, tense

═══════════════════════════════════════════════════════════════════
PHOTOREALISTIC PROMPTING (Think like a photographer)
═══════════════════════════════════════════════════════════════════

CAMERA LANGUAGE:
- Lens: "shot on 50mm f/1.8", "85mm portrait lens", "24mm wide angle", "macro lens"
- Depth of field: "shallow DOF with creamy bokeh", "deep focus", "tilt-shift"
- Camera movement: "steady cam following", "handheld documentary feel"

LIGHTING SETUPS:
- "Three-point softbox lighting with subtle rim light"
- "Natural window light from camera left, soft fill from right"
- "Dramatic chiaroscuro lighting, deep shadows"
- "Golden hour backlighting creating lens flare"

TEXTURE & DETAIL:
- "Fine skin texture with natural pores visible"
- "Fabric weave catching the light"
- "Condensation droplets on cold glass surface"

═══════════════════════════════════════════════════════════════════
VEO 3 VIDEO GENERATION (Google Official 2025 Guidelines)
═══════════════════════════════════════════════════════════════════

GOLDEN RULE: Optimal Prompt Structure
- Length: 3-6 sentences, 100-150 words (Veo 3 sweet spot)
- Structure: Subject → Action → Setting → Style → Camera → Audio
- Write narrative prose, NOT keyword lists

VEO 3 CAMERA TERMINOLOGY (Use these specific terms):
- "slow dolly-in" - intimate approach toward subject
- "static on tripod" - stable professional look
- "handheld tracking shot" - documentary feel
- "smooth crane up/down" - cinematic reveal
- "orbital pan" - 360° product showcase
- "pull focus rack" - shift attention between subjects
- "steady tracking alongside" - following movement

VEO 3 AUDIO ELEMENTS (Native Audio Support):
- Ambient sounds: "soft wind", "city traffic", "rain on windows"
- Music style: "upbeat electronic", "melancholic piano", "cinematic orchestral"
- Sound effects: "footsteps on gravel", "door opening", "glass clinking"
- Always specify audio that matches the visual mood

VEO 3 DIALOGUE (Native Lip-Sync Support):
- Keep dialogue to 6-12 words for 8-second clips
- Specify speaker and emotional tone clearly
- Example: 'She looks up and says confidently, "This changes everything."'
- Ensure clear mouth visibility for lip-sync

VEO 3 MOTION QUALITY DESCRIPTORS:
- "smooth" - fluid, graceful movement
- "dynamic" - energetic, impactful motion
- "subtle" - gentle micro-movements
- "fluid" - natural, flowing transitions
- "dramatic" - bold, cinematic motion

NEGATIVE PROMPTS (What to Exclude):
- "no text overlays, no subtitles, no watermarks"
- "no abrupt cuts, no flash frames"
- "no crowds, no background distractions"

═══════════════════════════════════════════════════════════════════
I2V WORKFLOW SPECIALIZATIONS
═══════════════════════════════════════════════════════════════════

FIRST FRAME OPTIMIZATION:
- Position subjects in natural starting poses for motion
- Leave "motion space" - room for subjects to move into
- Establish clear focal points that can be tracked
- Lighting should support the intended movement direction

VIDEO TRANSITION PREPARATION:
- Describe elements that will create satisfying motion
- Hair, fabric, particles, water - elements with natural flow
- Avoid static poses that will look frozen

CONSISTENCY MARKERS:
- Document specific visual details that MUST persist
- Color values, lighting direction, subject proportions
- Background elements, atmospheric conditions

Always respond in valid JSON format.`,

    templates: {
      image: `Create a Gemini-optimized image prompt for this scene.

═══════════════════════════════════════════════════════════════════
INPUT CONTEXT
═══════════════════════════════════════════════════════════════════

SCENE DESCRIPTION:
{{sceneDescription}}

REQUESTED STYLE: {{style}}
DESIRED MOOD: {{mood}}

═══════════════════════════════════════════════════════════════════
YOUR TASK: Transform into a cinematographic masterpiece prompt
═══════════════════════════════════════════════════════════════════

REMEMBER: Write a NARRATIVE PARAGRAPH, not keyword lists!
Gemini's language understanding thrives on descriptive prose.

MANDATORY ELEMENTS TO INCLUDE:

1. SUBJECT (Hyper-specific)
   - WHO/WHAT exactly? Age, expression, clothing details, posture
   - Distinguishing features that make them unique

2. COMPOSITION (Cinematographer's eye)
   - Shot type: extreme close-up, medium shot, full body, wide establishing
   - Camera angle: eye-level, low angle (heroic), high angle (vulnerable), Dutch tilt
   - Rule of thirds? Centered? Leading lines?

3. ACTION (Frozen moment)
   - What's happening RIGHT NOW in this frame?
   - Body language, gesture, movement direction
   - "Caught mid-action" creates better video transitions

4. LOCATION (Immersive environment)
   - Specific place with atmospheric details
   - Foreground, midground, background elements
   - Environmental storytelling

5. STYLE (Visual treatment)
   - Photography style: editorial, cinematic, documentary, commercial
   - Reference: "shot on 85mm f/1.4", "Kodak Portra 400 film grain"
   - Art direction: color palette, contrast level, saturation

6. LIGHTING (Paint with light)
   - Direction: front, side, back, Rembrandt, split
   - Quality: soft diffused, hard dramatic, natural ambient
   - Time of day: golden hour, blue hour, midday, night

I2V FIRST FRAME OPTIMIZATION:
- Position subject with "motion space" to move into
- Include elements that will animate beautifully (hair, fabric, smoke, water)
- Establish clear focal point for eye tracking
- Avoid perfectly static poses - capture "decisive moments"

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT (Veo 3 First Frame Optimized)
═══════════════════════════════════════════════════════════════════

Return JSON:
{
  "prompt": "A vivid, narrative paragraph (100-150 words, 3-6 sentences) describing the scene as if directing a cinematographer. Flow naturally from subject to environment to mood. Include specific camera/lens references and lighting details. Write prose, not lists.",
  "promptType": "image",
  "styleNotes": "Key visual anchors: specific colors (hex if relevant), lighting direction, lens characteristics that define this image's look",
  "technicalSpecs": {
    "aspectRatio": "9:16|16:9|1:1"
  },
  "consistencyMarkers": ["5-7 specific visual elements that MUST persist in video: exact colors, lighting angle, subject proportions, key environmental features, atmospheric conditions"],
  "negativePrompt": "no text, no watermarks, no logos, no distracting backgrounds",
  "audioElements": {
    "ambientSound": "planned audio atmosphere for video transition",
    "music": "music style to match visual mood",
    "soundEffects": "anticipated sound effects for motion"
  },
  "motionQuality": "smooth|dynamic|subtle|fluid|dramatic"
}

QUALITY CHECKLIST (Verify before output):
☐ Is it a flowing narrative paragraph, not a keyword list?
☐ Is prompt 100-150 words (Veo 3 optimal length)?
☐ Does it specify camera/lens (e.g., "shot on 85mm f/1.4")?
☐ Does it describe lighting direction and quality?
☐ Is the subject hyper-specific, not generic?
☐ Does it include atmospheric/environmental details?
☐ Will this frame transition smoothly to video motion?
☐ Has negative prompt exclusions?
☐ Audio elements planned for video transition?`,

      video: `Create a VEO 3 optimized video prompt from this image analysis.

═══════════════════════════════════════════════════════════════════
SOURCE IMAGE ANALYSIS
═══════════════════════════════════════════════════════════════════

IMAGE ANALYSIS:
{{imageAnalysis}}

SCENE DESCRIPTION:
{{sceneDescription}}

DURATION: {{duration}} seconds
STYLE: {{style}}

═══════════════════════════════════════════════════════════════════
VEO 3 VIDEO MOTION DESIGN
═══════════════════════════════════════════════════════════════════

VEO 3 CAMERA MOVEMENTS (Use these exact terms):
- "static on tripod" - locked-off, professional stability
- "slow dolly-in" - gradual approach toward subject
- "slow dolly-out" - reveal environment
- "steady tracking alongside" - lateral movement
- "smooth crane up/down" - vertical sweep, cinematic
- "handheld tracking shot" - organic documentary feel
- "orbital pan" - 360° around subject
- "pull focus rack" - shift attention between subjects

SUBJECT MOTION PRINCIPLES:
- Natural physics: hair sways, fabric ripples, breath visible
- Micro-movements: blinks, subtle weight shifts, finger movements
- Environmental reaction: wind effect, light changes, ambient motion
- Emotional beats: expressions shifting, gestures completing

MOTION QUALITY (Choose one):
- smooth: fluid, graceful movement (luxury, elegance)
- dynamic: energetic, impactful motion (action, excitement)
- subtle: gentle micro-movements (intimate, calm)
- fluid: natural, flowing transitions (organic, lifelike)
- dramatic: bold, cinematic motion (storytelling, impact)

═══════════════════════════════════════════════════════════════════
VEO 3 AUDIO DESIGN (Native Audio Generation)
═══════════════════════════════════════════════════════════════════

AMBIENT SOUNDS: Match environment
- Indoor: "air conditioning hum", "clock ticking", "distant voices"
- Outdoor: "birdsong", "traffic", "wind through leaves"
- Urban: "city ambiance", "footsteps on pavement"

MUSIC (if appropriate):
- Style that enhances mood: "lo-fi beats", "cinematic strings", "upbeat pop"

SOUND EFFECTS:
- Action-specific: "fabric rustling", "door opening", "keys jingling"

VEO 3 DIALOGUE (if subject speaks):
- Keep to 6-12 words for {{duration}}-second clip
- Clear emotional tone
- Example: 'She smiles and says warmly, "This is exactly what I needed."'

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT (Veo 3 Optimized)
═══════════════════════════════════════════════════════════════════

Return JSON:
{
  "prompt": "Narrative description (100-150 words, 3-6 sentences) of how the scene unfolds. Structure: Subject action → Camera movement → Environmental response → Audio atmosphere. Use Veo 3 camera terms. End with audio cues.",
  "promptType": "video",
  "styleNotes": "Motion design: camera technique, motion quality, pacing rhythm",
  "technicalSpecs": {
    "duration": {{duration}},
    "frameRate": 24
  },
  "consistencyMarkers": ["Visual anchors: lighting direction, color temperature, subject proportions, key features"],
  "negativePrompt": "no text overlays, no watermarks, no abrupt cuts, no flash frames",
  "audioElements": {
    "ambientSound": "environmental background audio matching scene",
    "music": "music style/mood if appropriate, or null",
    "soundEffects": "action-specific sounds"
  },
  "dialogueContent": {
    "text": "6-12 word dialogue if subject speaks, or null",
    "speaker": "who speaks",
    "tone": "emotional delivery"
  },
  "motionQuality": "smooth|dynamic|subtle|fluid|dramatic"
}

QUALITY CHECKLIST:
☐ Prompt is 100-150 words (Veo 3 optimal)
☐ Uses specific Veo 3 camera terms
☐ Includes audio design (ambient + music + effects)
☐ Has negative prompt exclusions
☐ Motion quality specified`,

      background: `Create a cinematic background prompt for product/subject compositing.

═══════════════════════════════════════════════════════════════════
INPUT CONTEXT
═══════════════════════════════════════════════════════════════════

SUBJECT TO BE COMPOSITED: {{subject}}
STYLE: {{style}}
MOOD: {{mood}}

═══════════════════════════════════════════════════════════════════
BACKGROUND DESIGN PRINCIPLES
═══════════════════════════════════════════════════════════════════

COMPOSITIONAL HIERARCHY:
- Background SUPPORTS, never COMPETES with the subject
- Create visual "breathing room" for the subject
- Guide viewer's eye toward where subject will be placed

DEPTH & DIMENSION:
- Foreground elements: subtle blur, frame edges
- Midground: where subject will be placed (keep clear)
- Background: environmental context, slightly soft

LIGHTING COHERENCE:
- Establish clear light direction for subject matching
- Include subtle highlights/shadows for depth
- Match the mood's color temperature

COMPOSITING-READY FEATURES:
- Clean area for subject placement
- Consistent lighting across the frame
- No competing focal points in subject zone

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════

Return JSON:
{
  "prompt": "Narrative description (80-120 words) of an atmospheric background. Describe lighting direction, depth layers, color palette, and mood. Leave clear space for subject compositing. Include camera/lens reference for consistent look.",
  "promptType": "background",
  "styleNotes": "Compositing guidance: subject placement zone, lighting direction, color temperature, depth of field",
  "technicalSpecs": {
    "aspectRatio": "9:16"
  },
  "consistencyMarkers": ["primary light direction", "color temperature (warm/cool)", "atmospheric density", "depth layers", "ambient light quality"]
}`,

      sceneWithPlaceholder: `Transform scene prompt for two-step product composition workflow.

═══════════════════════════════════════════════════════════════════
INPUT CONTEXT
═══════════════════════════════════════════════════════════════════

ORIGINAL SCENE DESCRIPTION:
{{sceneDescription}}

PRODUCT TYPE (placeholder shape/size reference):
{{productDescription}}

HAND POSE: {{handPose}}
STYLE: {{style}}
ASPECT RATIO: {{aspectRatio}}

═══════════════════════════════════════════════════════════════════
TWO-STEP COMPOSITION STRATEGY
═══════════════════════════════════════════════════════════════════

OBJECTIVE: Generate a scene with a NEUTRAL PLACEHOLDER object
that will be replaced by the actual product in step 2.

PLACEHOLDER DESIGN PRINCIPLES:
- Shape: Match the product's general form (bottle, box, tube, etc.)
- Color: Neutral white/light gray - easy to mask and replace
- Material: Matte, non-reflective surface for clean edges
- Size: Proportional to how hands would naturally hold it
- Lighting: Well-lit from the scene's primary light source

SCENE PRESERVATION (CRITICAL):
✓ KEEP: All human elements (person, hands, pose, expression)
✓ KEEP: Environment and background exactly as described
✓ KEEP: Lighting setup, mood, atmosphere
✓ KEEP: Camera angle and composition
✗ CHANGE: Only the specific product → generic placeholder

SINGLE FRAME RULE:
- Output must describe ONE moment, ONE frame
- If original has multiple scenes, select the MAIN/FIRST scene only
- No transitions, no "then", no sequence descriptions

COMPOSITING-READY REQUIREMENTS:
1. Placeholder clearly visible and in sharp focus
2. Hands naturally gripping the placeholder
3. Clear separation between placeholder and background
4. Consistent lighting on placeholder for later matching

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════

Return JSON:
{
  "prompt": "Narrative paragraph (120-150 words) describing the scene with a neutral placeholder object. Maintain all cinematographic details from original. Specify: 'holding a smooth, matte white [shape] placeholder object' where the product would be. Include lighting direction hitting the placeholder.",
  "promptType": "sceneWithPlaceholder",
  "styleNotes": "Compositing preparation notes: placeholder position, lighting angle, shadow direction, grip style",
  "technicalSpecs": {
    "aspectRatio": "{{aspectRatio}}"
  },
  "consistencyMarkers": ["hand grip position", "lighting direction (clock face: e.g., 2 o'clock)", "shadow angle", "camera distance", "background elements", "color temperature"]
}`,

      composite: `Create precise compositing instructions for seamless product integration.

═══════════════════════════════════════════════════════════════════
INPUT CONTEXT
═══════════════════════════════════════════════════════════════════

SCENE DESCRIPTION: {{sceneDescription}}
PRODUCT DESCRIPTION: {{productDescription}}
PLACEMENT GUIDANCE: {{placementHint}}

═══════════════════════════════════════════════════════════════════
COMPOSITING WORKFLOW
═══════════════════════════════════════════════════════════════════

The AI will receive TWO images:
1. SCENE IMAGE: Hands holding a neutral placeholder object
2. PRODUCT IMAGE: The actual product to be composited

PLACEMENT PRECISION:
- Position: Product EXACTLY replaces placeholder location
- Angle: Match the placeholder's rotation and tilt
- Scale: Product fits naturally within the hand grip
- Perspective: Maintain consistent camera angle

LIGHTING INTEGRATION:
- Direction: Match scene's primary light source
- Intensity: Adjust product highlights to scene brightness
- Color temperature: Harmonize with scene's ambient light
- Reflections: Add appropriate specular highlights

SHADOW INTEGRATION:
- Contact shadows: Where product meets hands
- Cast shadows: Matching scene's shadow direction
- Ambient occlusion: Subtle darkening at contact points

EDGE TREATMENT:
- Clean masking: No visible edges or halos
- Natural falloff: Smooth transition to scene
- Depth matching: Consistent focus/blur with scene

PRESERVATION RULES:
✓ PRESERVE: Product's brand identity, colors, design
✓ PRESERVE: Scene's overall lighting and mood
✗ AVOID: Distorting product proportions
✗ AVOID: Mismatched lighting direction

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════

Return JSON:
{
  "prompt": "Step-by-step compositing instructions (100-150 words). Be specific: 'Position the product at [exact location], rotate [degrees] to match hand angle. Apply lighting from [direction] at [intensity]. Add contact shadow beneath [area]. Adjust color temperature to [warm/cool] to match scene ambient.'",
  "promptType": "composite",
  "styleNotes": "Technical compositing notes: exact lighting angle (clock face), shadow opacity percentage, color temperature adjustment, scale ratio",
  "technicalSpecs": {
    "aspectRatio": "9:16"
  },
  "consistencyMarkers": ["lighting direction (e.g., 10 o'clock)", "shadow angle", "scale ratio (e.g., 1:1.2)", "color temperature (K value if relevant)", "grip contact points"]
}`,
    },
  },

  inputSchema: I2VSpecialistInputSchema,
  outputSchema: I2VSpecialistOutputSchema,
};

/**
 * I2V Specialist Agent Implementation
 */
export class I2VSpecialistAgent extends BaseAgent<I2VSpecialistInput, I2VSpecialistOutput> {
  constructor() {
    super(I2VSpecialistConfig);
  }

  protected buildPrompt(input: I2VSpecialistInput, context: AgentContext): string {
    const template = this.getTemplate(input.promptType);

    const style = input.style ||
      context.discover?.contentStrategy?.visualGuidelines.styles[0] ||
      'cinematic, modern';

    const mood = input.mood ||
      context.discover?.visualPatterns?.[0]?.mood ||
      'engaging, dynamic';

    return this.fillTemplate(template, {
      sceneDescription: input.sceneDescription,
      style,
      mood,
      imageAnalysis: JSON.stringify(input.imageAnalysis || {}, null, 2),
      duration: input.duration,
      subject: input.subject || 'main subject',
      // For sceneWithPlaceholder
      productDescription: input.productDescription || 'product',
      handPose: input.handPose || 'naturally holding',
      aspectRatio: input.aspectRatio || '9:16',
      // For composite
      placementHint: input.placementHint || 'replace placeholder with product',
    });
  }

  /**
   * Generate image prompt for I2V first frame
   */
  async generateImagePrompt(
    sceneDescription: string,
    context: AgentContext,
    options?: { style?: string; mood?: string }
  ) {
    return this.execute(
      {
        promptType: 'image',
        sceneDescription,
        duration: 8, // Default duration
        style: options?.style,
        mood: options?.mood,
      },
      context
    );
  }

  /**
   * Generate video prompt from image analysis
   */
  async generateVideoPrompt(
    imageAnalysis: I2VSpecialistInput['imageAnalysis'],
    sceneDescription: string,
    context: AgentContext,
    options?: { duration?: number; style?: string }
  ) {
    return this.execute(
      {
        promptType: 'video',
        sceneDescription,
        imageAnalysis,
        duration: options?.duration || 8,
        style: options?.style,
      },
      context
    );
  }

  /**
   * Generate background prompt
   */
  async generateBackgroundPrompt(
    subject: string,
    context: AgentContext,
    options?: { style?: string; mood?: string }
  ) {
    return this.execute(
      {
        promptType: 'background',
        sceneDescription: `Background for ${subject}`,
        duration: 8, // Default duration
        subject,
        style: options?.style,
        mood: options?.mood,
      },
      context
    );
  }

  /**
   * Generate scene with placeholder prompt
   * Step 1 of 2-step composition: Creates a scene with a generic placeholder
   * that will later be replaced by the actual product image.
   */
  async generateSceneWithPlaceholder(
    sceneDescription: string,
    productDescription: string,
    context: AgentContext,
    options?: {
      handPose?: string;
      style?: string;
      aspectRatio?: string;
    }
  ) {
    return this.execute(
      {
        promptType: 'sceneWithPlaceholder',
        sceneDescription,
        productDescription,
        duration: 8,
        handPose: options?.handPose || 'naturally holding',
        style: options?.style,
        aspectRatio: options?.aspectRatio || '9:16',
      },
      context
    );
  }

  /**
   * Generate composite prompt
   * Step 2 of 2-step composition: Creates instructions for replacing
   * the placeholder with the actual product image.
   */
  async generateComposite(
    sceneDescription: string,
    productDescription: string,
    placementHint: string,
    context: AgentContext
  ) {
    return this.execute(
      {
        promptType: 'composite',
        sceneDescription,
        productDescription,
        placementHint,
        duration: 8,
      },
      context
    );
  }

  /**
   * Generate background-only prompt for image editing
   * Used when user provides a product image as reference.
   */
  async generateBackgroundForEditing(
    sceneDescription: string,
    productUsage: string,
    context: AgentContext,
    options?: { style?: string; aspectRatio?: string }
  ) {
    return this.execute(
      {
        promptType: 'background',
        sceneDescription: `${sceneDescription}. Product usage context: ${productUsage}`,
        duration: 8,
        subject: 'product reference image',
        style: options?.style,
        mood: 'professional, product-focused',
        aspectRatio: options?.aspectRatio,
      },
      context
    );
  }
}

// Factory function
export function createI2VSpecialistAgent(): I2VSpecialistAgent {
  return new I2VSpecialistAgent();
}
