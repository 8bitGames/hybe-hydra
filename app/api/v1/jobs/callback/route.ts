import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateGeoAeoContent } from "@/lib/geo-aeo-generator";

interface CallbackPayload {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  output_url?: string;
  error?: string;
  progress?: number;
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

// POST /api/v1/jobs/callback - Receive job status callbacks from compose-engine
export async function POST(request: NextRequest) {
  try {
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

    await prisma.videoGeneration.update({
      where: { id: job_id },
      data: updateData,
    });

    console.log(`[Job Callback] Updated job ${job_id}: ${status} → ${prismaStatus} (progress: ${finalProgress}%)`);

    // Check if this job has auto-publish settings
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: job_id },
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

        // Generate GEO/AEO content if enabled
        if (autoPublish.generateGeoAeo && searchTags && searchTags.length > 0) {
          console.log(`[Job Callback] Generating GEO/AEO content for job ${job_id}`);
          try {
            const geoAeoResult = await generateGeoAeoContent({
              keywords: searchTags,
              prompt: originalPrompt,
              vibe: settings?.vibe as "Exciting" | "Emotional" | "Pop" | "Minimal" | undefined,
              language: "ko",
              platform: "tiktok",
            });

            caption = geoAeoResult.combinedCaption;
            hashtags = geoAeoResult.combinedHashtags.map(tag => tag.replace(/^#/, ""));

            console.log(`[Job Callback] GEO/AEO content generated. Score: ${geoAeoResult.scores.overallScore}`);

            // Update metadata with generated content
            await prisma.videoGeneration.update({
              where: { id: job_id },
              data: {
                qualityMetadata: {
                  ...metadata,
                  geoAeoContent: {
                    caption,
                    hashtags,
                    score: geoAeoResult.scores.overallScore,
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
    console.error("[Job Callback] Error processing callback:", error);
    return NextResponse.json(
      { detail: "Failed to process callback" },
      { status: 500 }
    );
  }
}
