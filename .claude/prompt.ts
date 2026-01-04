import { GoogleGenAI } from '@google/genai';
import { supabaseServiceClient } from '@/lib/supabase-service';

type PromptContent =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

export interface GenerateImageParams {
  prompt: string;
  referenceImages: string[]; // Supabase Storage URLs or base64 images
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  numberOfImages?: number;
  negativePrompt?: string;
}

export interface GenerationResult {
  imageUrls: string[];
  metadata: {
    model: string;
    prompt: string;
    aspectRatio: string;
    numberOfImages: number;
    generatedAt: string;
  };
}

export class Imagen3Service {
  private client: GoogleGenAI | null = null;
  private modelName = 'gemini-3-pro-image-preview';

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    } else {
      console.warn('GOOGLE_AI_API_KEY not set. Imagen3 service will not work.');
    }
  }

  /**
   * Translate prompt to English if needed
   */
  private async translateToEnglish(text: string): Promise<string> {
    if (!this.client) {
      return text; // Return original if no client
    }

    try {
      // Use Gemini to translate
      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            text: `Translate this to English. If already in English, return as is. Only return the translated text, nothing else: "${text}"`,
          },
        ],
      });

      // Extract text from response
      let translatedText = text;
      if (response?.candidates?.[0]) {
        const candidate = response.candidates[0];
        if (candidate.content?.parts?.[0]) {
          translatedText = candidate.content.parts[0].text || text;
        }
      }

      console.log(`Translated: "${text}" → "${translatedText}"`);
      return translatedText.trim();
    } catch (error) {
      console.error('Translation error, using original:', error);
      return text;
    }
  }

  /**
   * Convert image URL to base64
   */
  private async urlToBase64(
    imageUrl: string,
  ): Promise<{ data: string; mimeType: string }> {
    try {
      // Fetch image from URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      // Get image buffer
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      // Determine mime type from response headers or URL extension
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      return {
        data: base64,
        mimeType: contentType,
      };
    } catch (error) {
      console.error('Error converting URL to base64:', error);
      throw error;
    }
  }

  /**
   * Generate images with reference images using Imagen3
   */
  async generateWithReference(
    params: GenerateImageParams,
  ): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error(
        'Imagen3 service not initialized. Missing GOOGLE_AI_API_KEY.',
      );
    }

    try {
      const {
        prompt,
        referenceImages,
        aspectRatio = '1:1',
        numberOfImages = 1,
        negativePrompt,
      } = params;

      // Translate prompt to English
      console.log('Translating prompt to English...');
      const translatedPrompt = await this.translateToEnglish(prompt);
      const translatedNegativePrompt = negativePrompt
        ? await this.translateToEnglish(negativePrompt)
        : null;

      // Convert reference images to base64 (max 5 per Google docs for best face consistency)
      const limitedReferenceImages = referenceImages.slice(0, 5);
      console.log('Converting reference images to base64...');
      console.log(
        `Processing ${limitedReferenceImages.length} reference images (limited from ${referenceImages.length})`,
      );

      const imageDataList = await Promise.all(
        limitedReferenceImages.map((url) => this.urlToBase64(url)),
      );

      // Build prompt content with text and reference images
      // Using concise, direct prompt for better face consistency (per Google docs)
      const detailedPrompt =
        `Generate a photo of this exact same person: ${translatedPrompt}

Keep the face identical to the reference images. Maintain the same facial features, skin tone, and hair.${translatedNegativePrompt ? ` Avoid: ${translatedNegativePrompt}` : ''}`.trim();

      const promptContent: PromptContent[] = [
        {
          text: detailedPrompt,
        },
      ];

      // Add reference images to prompt
      for (const imageData of imageDataList) {
        promptContent.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.data,
          },
        });
      }

      console.log('Generating image with Gemini API...');

      // Generate image using Gemini API
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: promptContent,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: '2K',
          },
        },
      });

      // Log the full response for debugging
      console.log('Gemini API Response:', JSON.stringify(response, null, 2));

      // Extract generated image from response
      // Note: This is a placeholder - actual Gemini image generation API might have different response structure
      const generatedImages: string[] = [];

      if (response?.candidates?.[0]) {
        const candidate = response.candidates[0];

        console.log('Candidate structure:', JSON.stringify(candidate, null, 2));

        // Check for safety filter blocking
        if (candidate.finishReason === 'IMAGE_SAFETY') {
          throw new Error(
            "Image generation was blocked by safety filters. This may happen if the content, prompt, or reference images violate Google's safety policies. Please try: 1) Using different reference images, 2) Modifying your prompt to be more general, or 3) Using a different image generation provider.",
          );
        }

        // Check if response contains image data
        if (candidate.content?.parts) {
          console.log('Parts found:', candidate.content.parts.length);
          for (const part of candidate.content.parts) {
            console.log('Part structure:', JSON.stringify(part, null, 2));
            if (part.inlineData) {
              // Upload generated image to Supabase Storage
              const imageUrl = await this.uploadGeneratedImage(
                part.inlineData.data,
                part.inlineData.mimeType,
              );
              generatedImages.push(imageUrl);
            }
          }
        }
      }

      // If no images generated (API doesn't support image generation yet),
      // return a placeholder or throw error
      if (generatedImages.length === 0) {
        console.error(
          'No images generated. Response structure:',
          JSON.stringify(response, null, 2),
        );
        throw new Error(
          'No images generated from Gemini API. The API may not support image generation with the current configuration. Consider using SeeDream or RunPod providers instead.',
        );
      }

      return {
        imageUrls: generatedImages,
        metadata: {
          model: this.modelName,
          prompt: prompt,
          aspectRatio: aspectRatio,
          numberOfImages: numberOfImages,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error generating image with Imagen3:', error);
      throw new Error(
        `Imagen3 generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Upload generated image to Supabase Storage
   */
  private async uploadGeneratedImage(
    base64Data: string,
    mimeType: string,
  ): Promise<string> {
    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');

      // Generate unique filename
      const timestamp = Date.now();
      const extension = mimeType.split('/')[1] || 'jpg';
      const fileName = `generated-${timestamp}.${extension}`;
      const filePath = `generated-images/${fileName}`;

      // Upload to Supabase Storage
      const { error } = await supabaseServiceClient.storage
        .from('creator-model-images')
        .upload(filePath, buffer, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabaseServiceClient.storage
        .from('creator-model-images')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading generated image:', error);
      throw error;
    }
  }

  /**
   * Generate image without reference (text-to-image only)
   */
  async generateFromText(
    prompt: string,
    numberOfImages: number = 1,
  ): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error(
        'Imagen3 service not initialized. Missing GOOGLE_AI_API_KEY.',
      );
    }

    try {
      console.log('Generating image from text with Gemini API...');

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: [{ text: `Create an image: ${prompt}` }],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: '2K',
          },
        },
      });

      const generatedImages: string[] = [];

      if (response?.candidates?.[0]) {
        const candidate = response.candidates[0];

        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const imageUrl = await this.uploadGeneratedImage(
                part.inlineData.data,
                part.inlineData.mimeType,
              );
              generatedImages.push(imageUrl);
            }
          }
        }
      }

      if (generatedImages.length === 0) {
        throw new Error(
          'No images generated. Gemini API may not support image generation yet.',
        );
      }

      return {
        imageUrls: generatedImages,
        metadata: {
          model: this.modelName,
          prompt: prompt,
          aspectRatio: '1:1',
          numberOfImages: numberOfImages,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error generating image from text:', error);
      throw new Error(
        `Text-to-image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Step 1: Generate a profile image with clothing from reference images
   * Creates a front-facing profile with face prominently featured and clothing applied
   */
  async generateBaseProfile(
    referenceImages: string[],
    clothingPrompt?: string,
  ): Promise<string> {
    if (!this.client) {
      throw new Error(
        'Imagen3 service not initialized. Missing GOOGLE_AI_API_KEY.',
      );
    }

    try {
      console.log(
        'Step 1: Generating profile image with clothing (face lock)...',
      );
      console.log(`Using ${referenceImages.length} reference images`);

      // Convert all reference images to base64
      const imageDataList = await Promise.all(
        referenceImages.map((url) => this.urlToBase64(url)),
      );

      // Translate clothing prompt if provided
      const translatedClothing = clothingPrompt
        ? await this.translateToEnglish(clothingPrompt)
        : null;

      // Profile prompt with clothing - face is the main focus
      const clothingInstruction = translatedClothing
        ? `Dress them appropriately for this context: ${translatedClothing}. Choose clothing and accessories that fit the scene naturally while keeping the focus on their face.`
        : `They are wearing a simple white crew-neck t-shirt.`;

      const profilePrompt = `
Create a close-up portrait photograph of the person shown in the reference images. This should be a HEAD AND SHOULDERS shot with the FACE taking up a large portion of the frame - approximately 60-70% of the image should be the face and upper body.

The photograph should be shot with an 85mm portrait lens at f/2.8, creating a soft background blur while keeping the face in sharp focus. Use soft, diffused studio lighting from the front with a gentle fill light to eliminate harsh shadows on the face. The background must be clean, pure white.

The person should be positioned facing directly toward the camera. Their expression is natural and relaxed, with a slight, genuine smile.

${clothingInstruction}

CRITICAL - FACE ACCURACY IS THE HIGHEST PRIORITY:
Study all the provided reference photos carefully to understand this person's complete identity. The face must be an EXACT match:
- Precise shape of their eyes, eye color, and eye spacing
- Structure of their nose - bridge, tip, and nostrils
- Form of their lips - shape, fullness, and color
- Jawline contour and chin shape
- Exact skin tone and texture
- Every distinctive feature: moles, freckles, dimples, wrinkles
- Hair color, texture, and style must match exactly

Also preserve their body type and proportions as shown in the references.

This portrait serves as an identity reference for subsequent image generation, so FACIAL ACCURACY is paramount. The face should be large, clear, and well-lit. Shot at high resolution with photorealistic quality.
`.trim();

      const promptContent: PromptContent[] = [{ text: profilePrompt }];

      // Add all reference images
      for (const imageData of imageDataList) {
        promptContent.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.data,
          },
        });
      }

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: promptContent,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: '2K',
          },
        },
      });

      // Extract generated image
      if (response?.candidates?.[0]) {
        const candidate = response.candidates[0];
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const imageUrl = await this.uploadGeneratedImage(
                part.inlineData.data,
                part.inlineData.mimeType,
              );
              console.log('Base profile image generated successfully');
              return imageUrl;
            }
          }
        }
      }

      // No fallback - throw error if generation fails
      throw new Error('Profile generation failed: No image was generated');
    } catch (error) {
      console.error('Error generating base profile:', error);
      throw new Error(
        `Base profile generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Step 2: Apply clothing/styling to the base profile
   * Changes only the clothing while keeping face and background the same
   */
  async applyClothing(
    baseProfileUrl: string,
    scenePrompt: string,
  ): Promise<string> {
    if (!this.client) {
      throw new Error(
        'Imagen3 service not initialized. Missing GOOGLE_AI_API_KEY.',
      );
    }

    try {
      console.log('Step 2: Applying clothing/styling to profile...');

      // Translate prompt to get clothing context
      const translatedPrompt = await this.translateToEnglish(scenePrompt);

      // Convert base profile to base64
      const profileData = await this.urlToBase64(baseProfileUrl);

      // Clothing change prompt - only change clothes
      const clothingPrompt = `
REFERENCE: Use this profile image as the template. Keep EVERYTHING except the clothing.

ABSOLUTE PRESERVATION (DO NOT CHANGE):
- Face must be PIXEL-PERFECT identical - no changes at all
- All facial features, skin tone, expression - exactly the same
- Hair style and color - must match exactly
- Background - keep pure white
- Pose and body position - maintain exactly

ONLY CHANGE:
- Clothing to match this context: ${translatedPrompt}
- Choose appropriate clothing/accessories for the scene

OUTPUT:
- Same white background
- Same pose
- Same face
- Only the clothing is different
- High resolution, photorealistic quality

CRITICAL: The face must be 100% identical to the reference. Only change the clothes.
`.trim();

      const promptContent: PromptContent[] = [
        { text: clothingPrompt },
        {
          inlineData: {
            mimeType: profileData.mimeType,
            data: profileData.data,
          },
        },
      ];

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: promptContent,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: '2K',
          },
        },
      });

      if (response?.candidates?.[0]) {
        const candidate = response.candidates[0];
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const imageUrl = await this.uploadGeneratedImage(
                part.inlineData.data,
                part.inlineData.mimeType,
              );
              console.log('Styled profile generated successfully');
              return imageUrl;
            }
          }
        }
      }

      // Fallback
      console.warn('Clothing application failed, using base profile');
      return baseProfileUrl;
    } catch (error) {
      console.error('Error applying clothing:', error);
      throw new Error(
        `Clothing application failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Step 3: Add background/environment to the styled profile
   * Changes only the background while keeping face and clothing the same
   */
  async addBackground(
    styledProfileUrl: string,
    scenePrompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1',
    negativePrompt?: string,
  ): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error(
        'Imagen3 service not initialized. Missing GOOGLE_AI_API_KEY.',
      );
    }

    try {
      console.log('Step 3: Adding background to styled profile...');

      // Translate prompts
      const translatedPrompt = await this.translateToEnglish(scenePrompt);
      const translatedNegativePrompt = negativePrompt
        ? await this.translateToEnglish(negativePrompt)
        : null;

      // Convert styled profile to base64
      const profileData = await this.urlToBase64(styledProfileUrl);

      // Background addition prompt - only change background
      const detailedPrompt = `
REFERENCE: Use this profile image as the EXACT template. The person is already styled correctly.

ABSOLUTE PRESERVATION (DO NOT CHANGE AT ALL):
- Face must be PIXEL-PERFECT identical to the reference
- All facial features: eyes, nose, mouth, jawline - NO changes
- Skin tone, texture, expression - exactly the same
- Hair style and color - must match exactly
- Clothing - keep exactly the same
- Upper body pose - maintain exactly

ONLY ADD/CHANGE:
- Replace white background with: ${translatedPrompt}
- Natural lighting adjustments to match the environment
- Environmental shadows and reflections

SCENE CONTEXT:
${translatedPrompt}

QUALITY STANDARDS:
- Photorealistic, high-resolution output
- The person should look naturally placed in this location
- Professional photography quality
- Seamless integration with environment
${translatedNegativePrompt ? `\nAVOID: ${translatedNegativePrompt}` : ''}

CRITICAL: Face and clothing must remain 100% identical. Only the background changes.
`.trim();

      const promptContent: PromptContent[] = [
        { text: detailedPrompt },
        {
          inlineData: {
            mimeType: profileData.mimeType,
            data: profileData.data,
          },
        },
      ];

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: promptContent,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: '2K',
          },
        },
      });

      const generatedImages: string[] = [];

      if (response?.candidates?.[0]) {
        const candidate = response.candidates[0];
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const imageUrl = await this.uploadGeneratedImage(
                part.inlineData.data,
                part.inlineData.mimeType,
              );
              generatedImages.push(imageUrl);
            }
          }
        }
      }

      if (generatedImages.length === 0) {
        console.warn('Scene generation returned no images');
        generatedImages.push(styledProfileUrl);
      }

      return {
        imageUrls: generatedImages,
        metadata: {
          model: this.modelName,
          prompt: scenePrompt,
          aspectRatio: aspectRatio,
          numberOfImages: 1,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error generating scene image:', error);
      throw new Error(
        `Scene generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Add background only to a profile image (keep face and clothing exactly the same)
   */
  async addBackgroundOnly(
    profileUrl: string,
    scenePrompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1',
    negativePrompt?: string,
  ): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error(
        'Imagen3 service not initialized. Missing GOOGLE_AI_API_KEY.',
      );
    }

    try {
      console.log('Adding background only (preserving face and clothing)...');

      // Translate prompts
      const translatedPrompt = await this.translateToEnglish(scenePrompt);
      const translatedNegativePrompt = negativePrompt
        ? await this.translateToEnglish(negativePrompt)
        : null;

      // Convert profile to base64
      const profileData = await this.urlToBase64(profileUrl);

      // Background-only prompt - absolutely preserve face and clothing
      const backgroundPrompt = `
Using the provided portrait image as an EXACT template, place this person in a new environment.

ABSOLUTE PRESERVATION - DO NOT CHANGE:
- The person's FACE must remain 100% identical - every facial feature exactly as shown
- All facial characteristics: eyes, nose, lips, jawline, skin tone, expression
- Hair style and color - must be exactly the same
- The CLOTHING must remain exactly the same - same outfit, same colors, same style
- Body pose and positioning

ONLY CHANGE:
- Replace the white background with an environment matching: ${translatedPrompt}
- Add natural lighting that fits the new environment
- Add appropriate shadows and environmental lighting on the person

The person should appear naturally placed in this new setting while their face and clothing remain completely unchanged from the reference image.

Scene context: ${translatedPrompt}
${translatedNegativePrompt ? `\nAvoid: ${translatedNegativePrompt}` : ''}

CRITICAL: Face and clothing must be PIXEL-PERFECT identical to the reference. Only the background changes.

Output: High-resolution, photorealistic photograph with seamless integration.
`.trim();

      const promptContent: PromptContent[] = [
        { text: backgroundPrompt },
        {
          inlineData: {
            mimeType: profileData.mimeType,
            data: profileData.data,
          },
        },
      ];

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: promptContent,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: '2K',
          },
        },
      });

      const generatedImages: string[] = [];

      if (response?.candidates?.[0]) {
        const candidate = response.candidates[0];
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const imageUrl = await this.uploadGeneratedImage(
                part.inlineData.data,
                part.inlineData.mimeType,
              );
              generatedImages.push(imageUrl);
            }
          }
        }
      }

      if (generatedImages.length === 0) {
        throw new Error('Background addition failed: No image was generated');
      }

      return {
        imageUrls: generatedImages,
        metadata: {
          model: this.modelName,
          prompt: scenePrompt,
          aspectRatio: aspectRatio,
          numberOfImages: 1,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error adding background:', error);
      throw new Error(
        `Background addition failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate a scene image from text prompt only (no face reference)
   */
  async generateSceneFromText(
    scenePrompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1',
    negativePrompt?: string,
  ): Promise<string> {
    if (!this.client) {
      throw new Error(
        'Imagen3 service not initialized. Missing GOOGLE_AI_API_KEY.',
      );
    }

    try {
      console.log('Generating scene image from text prompt...');

      const translatedPrompt = await this.translateToEnglish(scenePrompt);
      const translatedNegativePrompt = negativePrompt
        ? await this.translateToEnglish(negativePrompt)
        : null;

      const sceneTextPrompt = `
Create a photorealistic image of a person in the following scene: ${translatedPrompt}

Requirements:
- High-resolution, professional photography quality
- Natural lighting appropriate for the scene
- The person should be clearly visible with their face in focus
- Realistic pose and expression fitting the context
${translatedNegativePrompt ? `\nAvoid: ${translatedNegativePrompt}` : ''}
`.trim();

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: [{ text: sceneTextPrompt }],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: '2K',
          },
        },
      });

      if (response?.candidates?.[0]) {
        const candidate = response.candidates[0];
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const imageUrl = await this.uploadGeneratedImage(
                part.inlineData.data,
                part.inlineData.mimeType,
              );
              console.log('Scene image generated successfully');
              return imageUrl;
            }
          }
        }
      }

      throw new Error('Scene generation failed: No image was generated');
    } catch (error) {
      console.error('Error generating scene from text:', error);
      throw new Error(
        `Scene generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Swap face in a scene image with face from reference image
   */
  async swapFace(
    sceneImageUrl: string,
    referenceImageUrl: string,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1',
  ): Promise<string> {
    if (!this.client) {
      throw new Error(
        'Imagen3 service not initialized. Missing GOOGLE_AI_API_KEY.',
      );
    }

    try {
      console.log('Swapping face from reference image...');

      // Convert both images to base64
      const sceneData = await this.urlToBase64(sceneImageUrl);
      const referenceData = await this.urlToBase64(referenceImageUrl);

      const faceSwapPrompt = `
I am providing two images:
1. SCENE IMAGE: A photograph of a person in a specific setting
2. REFERENCE IMAGE: A photograph showing the target person's face

YOUR TASK: Seamlessly integrate the face from the REFERENCE IMAGE into the SCENE IMAGE as if the person was originally photographed there.

FACE IDENTITY (from REFERENCE IMAGE):
- Exact facial structure: eyes, nose, lips, jawline, cheekbones
- All distinctive features: moles, freckles, dimples, skin texture
- Hair color and style

CRITICAL - NATURAL INTEGRATION:
1. LIGHTING ADAPTATION:
   - Adjust face lighting to match the scene's light direction and intensity
   - Apply appropriate shadows on the face based on scene lighting
   - Color-correct skin tones to match the ambient light (warm/cool/neutral)
   - Add highlights and shadows consistent with the environment

2. SEAMLESS BLENDING:
   - Blend face edges naturally with neck and hairline
   - Match skin color temperature with the scene
   - Ensure no visible seams or cut-out appearance
   - Hair should naturally integrate with the background

3. PERSPECTIVE & ANGLE:
   - Adjust face angle to match body pose in scene
   - Maintain proper proportions relative to the body
   - Eyes should look natural for the head position

4. ENVIRONMENTAL EFFECTS:
   - Apply any ambient effects (fog, haze, colored lighting)
   - Add reflections if scene has reflective surfaces nearby
   - Include environmental color cast on skin

PRESERVE FROM SCENE IMAGE:
- Body pose and positioning
- Clothing and accessories
- Background and environment
- Overall composition and framing

The final result must look like a single authentic photograph where the person was actually present in that location, NOT like a face pasted onto another image. The integration should be completely undetectable.

Output: High-resolution, photorealistic photograph with perfectly integrated face that matches the scene's lighting and atmosphere.
`.trim();

      const promptContent: PromptContent[] = [
        { text: faceSwapPrompt },
        {
          inlineData: {
            mimeType: sceneData.mimeType,
            data: sceneData.data,
          },
        },
        {
          inlineData: {
            mimeType: referenceData.mimeType,
            data: referenceData.data,
          },
        },
      ];

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: promptContent,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: '2K',
          },
        },
      });

      if (response?.candidates?.[0]) {
        const candidate = response.candidates[0];
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const imageUrl = await this.uploadGeneratedImage(
                part.inlineData.data,
                part.inlineData.mimeType,
              );
              console.log('Face swap completed successfully');
              return imageUrl;
            }
          }
        }
      }

      throw new Error('Face swap failed: No image was generated');
    } catch (error) {
      console.error('Error swapping face:', error);
      throw new Error(
        `Face swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Two-stage generation workflow with face swap
   * 1. Generate scene from text prompt
   * 2. Swap face using reference image
   */
  async generateTwoStage(
    params: GenerateImageParams,
  ): Promise<GenerationResult & { baseProfileUrl: string }> {
    console.log('=== Starting Two-Stage Generation (Face Swap) ===');

    // Stage 1: Generate scene from text prompt (no face reference)
    const sceneImageUrl = await this.generateSceneFromText(
      params.prompt,
      params.aspectRatio,
      params.negativePrompt,
    );
    console.log('Stage 1 complete: Scene image generated');

    // Stage 2: Swap face using first reference image
    const referenceImage = params.referenceImages[0];
    const finalImageUrl = await this.swapFace(
      sceneImageUrl,
      referenceImage,
      params.aspectRatio,
    );
    console.log('Stage 2 complete: Face swapped');

    return {
      imageUrls: [sceneImageUrl, finalImageUrl], // [프롬프트 장면, Face Swap 결과]
      metadata: {
        model: this.modelName,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || '1:1',
        numberOfImages: 2,
        generatedAt: new Date().toISOString(),
      },
      baseProfileUrl: sceneImageUrl,
    };
  }

  /**
   * Generate scene image from profile - applies clothing AND background in one step
   */
  async generateSceneFromProfile(
    profileUrl: string,
    scenePrompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1',
    negativePrompt?: string,
  ): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error(
        'Imagen3 service not initialized. Missing GOOGLE_AI_API_KEY.',
      );
    }

    try {
      console.log(
        'Generating scene with clothing and background from profile...',
      );

      // Translate prompts
      const translatedPrompt = await this.translateToEnglish(scenePrompt);
      const translatedNegativePrompt = negativePrompt
        ? await this.translateToEnglish(negativePrompt)
        : null;

      // Convert profile to base64
      const profileData = await this.urlToBase64(profileUrl);

      // Combined clothing + background prompt - descriptive paragraph style
      const detailedPrompt = `
Using the provided profile image as the exact identity reference, create a new photograph of this same person in a different scene. The person's face and body must remain completely identical to the reference image - study their facial features carefully: the shape of their eyes, nose structure, lip form, jawline, skin tone, and any distinctive marks like moles or freckles. Also preserve their exact body type, figure, and physical proportions. These must all be preserved exactly as shown.

Place this person in the following scene: ${translatedPrompt}

Dress them appropriately for this setting with clothing and accessories that fit the context naturally while still showcasing their figure and body type accurately. Adjust their pose and body position to suit the new environment while maintaining their recognizable identity and physique. The lighting should match the scene realistically - if outdoors, use natural daylight; if indoors, use appropriate ambient lighting that complements both the person and the surroundings.

Shoot this as a professional photograph with high resolution and photorealistic quality. The person should appear naturally integrated into the scene, as if they were actually photographed there. Use appropriate depth of field and focus to create a compelling composition.
${translatedNegativePrompt ? `\nAvoid including: ${translatedNegativePrompt}` : ''}

Remember: the face is the most critical element and must match the reference image exactly. The identity should be immediately recognizable.
`.trim();

      const promptContent: PromptContent[] = [
        { text: detailedPrompt },
        {
          inlineData: {
            mimeType: profileData.mimeType,
            data: profileData.data,
          },
        },
      ];

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: promptContent,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: '2K',
          },
        },
      });

      const generatedImages: string[] = [];

      if (response?.candidates?.[0]) {
        const candidate = response.candidates[0];
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const imageUrl = await this.uploadGeneratedImage(
                part.inlineData.data,
                part.inlineData.mimeType,
              );
              generatedImages.push(imageUrl);
            }
          }
        }
      }

      if (generatedImages.length === 0) {
        throw new Error('Scene generation failed: No image was generated');
      }

      return {
        imageUrls: generatedImages,
        metadata: {
          model: this.modelName,
          prompt: scenePrompt,
          aspectRatio: aspectRatio,
          numberOfImages: 1,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error generating scene from profile:', error);
      throw new Error(
        `Scene generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export const imagen3Service = new Imagen3Service();
