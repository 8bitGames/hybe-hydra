import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createGeoAeoOptimizerAgent } from "@/lib/agents/publishers";
import type { AgentContext } from "@/lib/agents/types";

interface CallbackPayload {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  output_url?: string;
  error?: string;
  progress?: number;
  metadata?: {
    generation_id?: string;
    gcs_uri?: string;
    extension_count?: number;
    original_generation_id?: string;
    extension_number?: number;
  };
}

// Publishing callback from EC2 backend
interface PublishCallbackPayload {
  job_id: string;
  post_id: string;
  platform: "tiktok" | "youtube" | "instagram";
  status: "completed" | "failed";
  result?: {
    // TikTok
    publish_id?: string;
    // YouTube
    video_id?: string;
    video_url?: string;
    channel_id?: string;
    // Instagram
    media_id?: string;
    permalink?: string;
  };
  error?: string;
}

interface AutoPublishSettings {
  enabled: boolean;
  socialAccountId: string;
  intervalMinutes: number;
  caption: string;
  hashtags: string[];
  variationIndex: number;
  generateGeoAeo?: boolean;
}

interface VariationSettings {
  effectPreset: string;
  colorGrade: string;
  textStyle: string;
  vibe: string;
}

// Map compose-engine status to Prisma VideoStatus enum
function mapStatusToPrisma(status: string): string {
  switch (status) {
    case "queued":
      return "PENDING"; // Waiting for render slot - shows as "대기중"
    case "processing":
      return "PROCESSING"; // Actively rendering - shows as "처리중"
    case "completed":
      return "COMPLETED";
    case "failed":
      return "FAILED";
    default:
      return "PENDING";
  }
}

// Handle publishing callback from EC2 backend
async function handlePublishCallback(body: PublishCallbackPayload): Promise<NextResponse> {
  const { job_id, post_id, platform, status, result, error } = body;

  console.log(`[Publish Callback] Received callback for post ${post_id}: ${platform} ${status}`);

  try {
    // Map status to Prisma enum
    const prismaStatus = status === "completed" ? "PUBLISHED" : "FAILED";

    // Build update data with platform-specific results
    const updateData: Record<string, unknown> = {
      status: prismaStatus,
      publishedAt: status === "completed" ? new Date() : null,
      updatedAt: new Date(),
    };

    if (error) {
      updateData.errorMessage = error;
    }

    // Store platform-specific result data in metadata
    if (result) {
      const publishResult: Record<string, unknown> = {
        platform,
        publishedAt: new Date().toISOString(),
      };

      if (platform === "tiktok" && result.publish_id) {
        publishResult.publishId = result.publish_id;
        publishResult.videoUrl = `https://www.tiktok.com/@user/video/${result.publish_id}`;
      } else if (platform === "youtube" && result.video_id) {
        publishResult.videoId = result.video_id;
        publishResult.videoUrl = result.video_url || `https://youtube.com/shorts/${result.video_id}`;
        publishResult.channelId = result.channel_id;
      } else if (platform === "instagram" && result.media_id) {
        publishResult.mediaId = result.media_id;
        publishResult.permalink = result.permalink;
      }

      updateData.publishResult = publishResult;
    }

    // Update the scheduled post
    await prisma.scheduledPost.update({
      where: { id: post_id },
      data: updateData,
    });

    console.log(`[Publish Callback] Updated post ${post_id}: ${platform} → ${prismaStatus}`);

    return NextResponse.json({ success: true, post_id, platform, status });
  } catch (dbError) {
    console.error(`[Publish Callback] Database error for post ${post_id}:`, dbError);
    return NextResponse.json(
      { detail: "Failed to update post status" },
      { status: 500 }
    );
  }
}

// POST /api/v1/jobs/callback - Receive job status callbacks from compose-engine
export async function POST(request: NextRequest) {
  try {
    // Check if this is a publishing callback
    const { searchParams } = new URL(request.url);
    const callbackType = searchParams.get("type");
    const postId = searchParams.get("postId");

    if (callbackType === "publish" && postId) {
      const body: PublishCallbackPayload = await request.json();
      body.post_id = postId; // Ensure post_id is set from query param
      return handlePublishCallback(body);
    }

    // Default: video generation callback
    const body: CallbackPayload = await request.json();
    const { job_id, status, output_url, error, progress } = body;

    console.log(`[Job Callback] Received callback for job ${job_id}: ${status} (progress: ${progress ?? 'N/A'})`);

    // Map status and determine progress
    const prismaStatus = mapStatusToPrisma(status);
    const finalProgress = status === "completed" || status === "failed" ? 100 : (progress ?? 0);

    // Update the video generation record
    const updateData: Record<string, unknown> = {
      status: prismaStatus,
      progress: finalProgress,
      updatedAt: new Date(),
    };

    if (output_url) {
      updateData.composedOutputUrl = output_url;
    }

    if (error) {
      updateData.errorMessage = error;
    }

    // Handle metadata from video generation/extension jobs
    const metadata = body.metadata;
    if (metadata) {
      // Update GCS URI if provided (required for video extension)
      if (metadata.gcs_uri) {
        updateData.gcsUri = metadata.gcs_uri;
      }

      // Update extension count if this was an extension job
      if (typeof metadata.extension_count === "number") {
        updateData.extensionCount = metadata.extension_count;
      }
    }

    // For extend jobs, use metadata.generation_id (the actual VideoGeneration ID)
    // For regular jobs, job_id IS the generation ID
    const generationId = metadata?.generation_id || job_id;

    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: updateData,
    });

    console.log(`[Job Callback] Updated generation ${generationId}: ${status} → ${prismaStatus} (progress: ${finalProgress}%)`);

    // Check if this job has auto-publish settings
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      select: {
        qualityMetadata: true,
        composedOutputUrl: true,
        campaignId: true,
        createdBy: true,
      },
    });

    if (generation?.qualityMetadata && status === "completed") {
      const metadata = generation.qualityMetadata as Record<string, unknown>;
      const autoPublish = metadata.autoPublish as AutoPublishSettings | null;
      const searchTags = metadata.searchTags as string[] | undefined;
      const settings = metadata.settings as VariationSettings | undefined;
      const originalPrompt = metadata.originalPrompt as string | undefined;

      if (autoPublish?.enabled && autoPublish.socialAccountId) {
        console.log(`[Job Callback] Auto-publish enabled for job ${job_id}`);

        let caption = autoPublish.caption || "";
        let hashtags = autoPublish.hashtags || [];

        // Generate GEO/AEO content if enabled (using Agent System)
        if (autoPublish.generateGeoAeo && searchTags && searchTags.length > 0) {
          console.log(`[Job Callback] Generating GEO/AEO content for job ${job_id}`);
          try {
            const agent = createGeoAeoOptimizerAgent();
            const agentContext: AgentContext = {
              workflow: {
                campaignId: generation.campaignId || undefined,
                artistName: "Unknown Artist",
                language: "ko",
                platform: "tiktok",
              },
            };

            const agentResult = await agent.execute({
              keywords: searchTags,
              prompt: originalPrompt,
              vibe: settings?.vibe as "Exciting" | "Emotional" | "Pop" | "Minimal" | undefined,
              language: "ko",
              platform: "tiktok",
            }, agentContext);

            if (!agentResult.success || !agentResult.data) {
              throw new Error(agentResult.error || "Agent execution failed");
            }

            const { geo, hashtags: hashtagsData, scores } = agentResult.data;

            // Build combined caption
            caption = `${geo.hookLine}\n\n${geo.caption}\n\n${geo.callToAction}`.slice(0, 2200);

            // Combine all hashtags
            hashtags = [
              ...hashtagsData.primary,
              ...hashtagsData.entity,
              ...hashtagsData.niche,
              ...hashtagsData.trending,
              ...hashtagsData.longTail,
            ].slice(0, 5).map(tag => tag.replace(/^#/, ""));

            console.log(`[Job Callback] GEO/AEO content generated. Score: ${scores.overallScore}`);

            // Update metadata with generated content
            await prisma.videoGeneration.update({
              where: { id: job_id },
              data: {
                qualityMetadata: {
                  ...metadata,
                  geoAeoContent: {
                    caption,
                    hashtags,
                    score: scores.overallScore,
                    generatedAt: new Date().toISOString(),
                  },
                },
              },
            });
          } catch (geoAeoError) {
            console.error(`[Job Callback] GEO/AEO generation failed for job ${job_id}:`, geoAeoError);
            // Continue with manual caption/hashtags if GEO/AEO fails
          }
        }

        // Schedule the post with the generated or manual content
        const baseTime = new Date();
        const scheduledTime = new Date(
          baseTime.getTime() + (autoPublish.variationIndex * autoPublish.intervalMinutes * 60 * 1000)
        );

        // Only schedule if we have required fields
        if (generation.campaignId && generation.createdBy) {
          try {
            await prisma.scheduledPost.create({
              data: {
                generationId: job_id,
                socialAccountId: autoPublish.socialAccountId,
                campaignId: generation.campaignId,
                createdBy: generation.createdBy,
                platform: "TIKTOK",
                status: "SCHEDULED",
                caption,
                hashtags,
                scheduledAt: scheduledTime,
                timezone: "Asia/Seoul",
              },
            });

            console.log(`[Job Callback] Scheduled post for job ${job_id} at ${scheduledTime.toISOString()}`);
          } catch (scheduleError) {
            console.error(`[Job Callback] Failed to schedule post for job ${job_id}:`, scheduleError);
          }
        } else {
          console.warn(`[Job Callback] Cannot schedule post for job ${job_id}: missing campaignId or createdBy`);
        }
      }
    }

    return NextResponse.json({ success: true, job_id, status });
  } catch (error) {
    // Enhanced error logging for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[Job Callback] Error processing callback:", {
      error: errorMessage,
      stack: errorStack,
      // Log the full error object for Prisma errors
      fullError: error,
    });
    return NextResponse.json(
      { detail: "Failed to process callback", error: errorMessage },
      { status: 500 }
    );
  }
}
