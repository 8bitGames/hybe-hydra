-- CreateEnum
CREATE TYPE "TrendPlatform" AS ENUM ('TIKTOK', 'YOUTUBE', 'INSTAGRAM');

-- CreateTable
CREATE TABLE "trend_snapshots" (
    "id" TEXT NOT NULL,
    "platform" "TrendPlatform" NOT NULL,
    "keyword" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'KR',
    "view_count" BIGINT,
    "video_count" INTEGER,
    "description" TEXT,
    "hashtags" TEXT[],
    "metadata" JSONB,
    "trend_url" TEXT,
    "thumbnail_url" TEXT,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "trend_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trend_snapshots_platform_region_idx" ON "trend_snapshots"("platform", "region");

-- CreateIndex
CREATE INDEX "trend_snapshots_collected_at_idx" ON "trend_snapshots"("collected_at");

-- CreateIndex
CREATE INDEX "trend_snapshots_rank_idx" ON "trend_snapshots"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "trend_snapshots_platform_keyword_region_collected_at_key" ON "trend_snapshots"("platform", "keyword", "region", "collected_at");
