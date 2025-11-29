-- CreateTable
CREATE TABLE "style_presets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ko" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "parameters" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_presets_pkey" PRIMARY KEY ("id")
);
