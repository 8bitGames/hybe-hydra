-- Image Search Cache - caches Google CSE results for 24 hours
-- Run this SQL in Supabase SQL Editor if prisma db push times out

-- Create image_search_cache table
CREATE TABLE IF NOT EXISTS "image_search_cache" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "cache_key" TEXT NOT NULL,
    "keywords" TEXT[],
    "search_params" JSONB,
    "results" JSONB NOT NULL,
    "total_results" INTEGER NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_search_cache_pkey" PRIMARY KEY ("id")
);

-- Create unique index on cache_key
CREATE UNIQUE INDEX IF NOT EXISTS "image_search_cache_cache_key_key" ON "image_search_cache"("cache_key");

-- Create index for cache lookup
CREATE INDEX IF NOT EXISTS "image_search_cache_cache_key_idx" ON "image_search_cache"("cache_key");

-- Create index for expiration cleanup
CREATE INDEX IF NOT EXISTS "image_search_cache_expires_at_idx" ON "image_search_cache"("expires_at");


-- Create cached_images table
CREATE TABLE IF NOT EXISTS "cached_images" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "source_url" TEXT NOT NULL,
    "source_url_hash" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "s3_url" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "source_title" TEXT,
    "source_domain" TEXT,
    "quality_score" DOUBLE PRECISION,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cached_images_pkey" PRIMARY KEY ("id")
);

-- Create unique index on source_url
CREATE UNIQUE INDEX IF NOT EXISTS "cached_images_source_url_key" ON "cached_images"("source_url");

-- Create index for URL hash lookup
CREATE INDEX IF NOT EXISTS "cached_images_source_url_hash_idx" ON "cached_images"("source_url_hash");

-- Create index for content hash lookup (deduplication)
CREATE INDEX IF NOT EXISTS "cached_images_content_hash_idx" ON "cached_images"("content_hash");

-- Create index for LRU cleanup
CREATE INDEX IF NOT EXISTS "cached_images_last_used_at_idx" ON "cached_images"("last_used_at");
