-- Add AI, nutrition, favorite count, and rating fields to recipes
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "is_ai_generated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "nutrition" JSONB;
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "favorite_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "review_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "recipes_average_rating_idx" ON "recipes"("average_rating" DESC);
CREATE INDEX IF NOT EXISTS "recipes_favorite_count_idx" ON "recipes"("favorite_count" DESC);
CREATE INDEX IF NOT EXISTS "recipes_is_ai_generated_idx" ON "recipes"("is_ai_generated");

-- Create recipe_reviews table
CREATE TABLE IF NOT EXISTS "recipe_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipe_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "author_name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "baby_age_month" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recipe_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS "recipe_reviews_recipe_id_user_id_key" ON "recipe_reviews"("recipe_id", "user_id");
CREATE INDEX IF NOT EXISTS "recipe_reviews_recipe_id_created_at_idx" ON "recipe_reviews"("recipe_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "recipe_reviews_user_id_idx" ON "recipe_reviews"("user_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'recipe_reviews_recipe_id_fkey'
    ) THEN
        ALTER TABLE "recipe_reviews" ADD CONSTRAINT "recipe_reviews_recipe_id_fkey"
        FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'recipe_reviews_user_id_fkey'
    ) THEN
        ALTER TABLE "recipe_reviews" ADD CONSTRAINT "recipe_reviews_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
