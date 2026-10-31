-- CreateEnum
CREATE TYPE "SaltLevel" AS ENUM ('NONE', 'LOW', 'NORMAL');

-- CreateEnum
CREATE TYPE "RecipeCategory" AS ENUM ('MEAL', 'SNACK');

-- CreateEnum
CREATE TYPE "MealCategory" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('GOOD', 'OK', 'REFUSED');

-- CreateEnum
CREATE TYPE "AmountEaten" AS ENUM ('ALL', 'HALF', 'LITTLE');

-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'PENDING_REGEN');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('WRONG_PORTION', 'UNSAFE_INGREDIENT', 'BAD_TASTE', 'OTHER');

-- CreateEnum
CREATE TYPE "AllergyStatus" AS ENUM ('CONFIRMED', 'SUSPECTED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('YOUTUBE', 'WEB', 'PUBLIC_INSTITUTION');

-- CreateEnum
CREATE TYPE "Allergen" AS ENUM ('EGG', 'MILK', 'BUCKWHEAT', 'PEANUT', 'SOYBEAN', 'WHEAT', 'MACKEREL', 'CRAB', 'SHRIMP', 'PORK', 'PEACH', 'TOMATO', 'SULFITE', 'WALNUT', 'CHICKEN', 'BEEF', 'SQUID', 'SHELLFISH', 'PINE_NUT');

-- CreateEnum
CREATE TYPE "IngredientGroup" AS ENUM ('GRAIN', 'VEGETABLE', 'FRUIT', 'MEAT', 'SEAFOOD', 'EGG', 'DAIRY', 'LEGUME_TOFU', 'NUT_SEED', 'SEASONING', 'PROCESSED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "login_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "recovery_code_hash" TEXT NOT NULL,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "usage_date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "babies" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nickname" TEXT,
    "age_month_at_input" INTEGER NOT NULL,
    "age_input_date" DATE NOT NULL,
    "salt_level" "SaltLevel" NOT NULL DEFAULT 'NONE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "babies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allergies" (
    "id" UUID NOT NULL,
    "baby_id" UUID NOT NULL,
    "ingredient_id" UUID,
    "allergen_type" "Allergen",
    "status" "AllergyStatus" NOT NULL DEFAULT 'CONFIRMED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "synonyms" TEXT[],
    "group" "IngredientGroup" NOT NULL,
    "allergen_type" TEXT,
    "allergens" "Allergen"[],
    "is_pantry_basic" BOOLEAN NOT NULL DEFAULT false,
    "is_salty_seasoning" BOOLEAN NOT NULL DEFAULT false,
    "min_age_month" INTEGER NOT NULL DEFAULT 12,
    "sodium_mg_per_100g" DOUBLE PRECISION NOT NULL,
    "grams_per_piece" DOUBLE PRECISION,
    "density_g_per_ml" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "caution_note" TEXT,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "slug" TEXT,
    "cache_key" TEXT,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "category" "RecipeCategory" NOT NULL,
    "meal_categories" "MealCategory"[],
    "age_stages" INTEGER[],
    "salt_level" "SaltLevel" NOT NULL,
    "cook_minutes" INTEGER NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "tools" TEXT[],
    "base_servings" INTEGER NOT NULL DEFAULT 2,
    "sodium_mg_per_serving" INTEGER NOT NULL,
    "allergens" "Allergen"[],
    "steps" JSONB NOT NULL,
    "baby_tips" JSONB NOT NULL,
    "storage_info" JSONB NOT NULL,
    "status" "RecipeStatus" NOT NULL DEFAULT 'ACTIVE',
    "quality_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "prep_note" TEXT,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "substitute_id" UUID,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_sources" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channel_or_site" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "trust_score" DOUBLE PRECISION NOT NULL DEFAULT 0.5,

    CONSTRAINT "recipe_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_logs" (
    "id" UUID NOT NULL,
    "baby_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "eaten_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meal_time" "MealCategory",
    "rating" "Rating" NOT NULL,
    "amount_eaten" "AmountEaten",
    "memo" TEXT,
    "reactions" TEXT[],

    CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pantry_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "added_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATE,

    CONSTRAINT "pantry_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_id_key" ON "users"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "ai_usages_usage_date_idx" ON "ai_usages"("usage_date");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usages_user_id_usage_date_key" ON "ai_usages"("user_id", "usage_date");

-- CreateIndex
CREATE INDEX "babies_user_id_idx" ON "babies"("user_id");

-- CreateIndex
CREATE INDEX "allergies_baby_id_idx" ON "allergies"("baby_id");

-- CreateIndex
CREATE UNIQUE INDEX "allergies_baby_id_ingredient_id_key" ON "allergies"("baby_id", "ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "allergies_baby_id_allergen_type_key" ON "allergies"("baby_id", "allergen_type");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_slug_key" ON "ingredients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- CreateIndex
CREATE INDEX "ingredients_name_idx" ON "ingredients"("name");

-- CreateIndex
CREATE INDEX "ingredients_group_idx" ON "ingredients"("group");

-- CreateIndex
CREATE INDEX "ingredients_synonyms_idx" ON "ingredients" USING GIN ("synonyms");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_slug_key" ON "recipes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_cache_key_key" ON "recipes"("cache_key");

-- CreateIndex
CREATE INDEX "recipes_status_salt_level_category_idx" ON "recipes"("status", "salt_level", "category");

-- CreateIndex
CREATE INDEX "recipes_age_stages_idx" ON "recipes" USING GIN ("age_stages");

-- CreateIndex
CREATE INDEX "recipes_allergens_idx" ON "recipes" USING GIN ("allergens");

-- CreateIndex
CREATE INDEX "recipes_quality_score_idx" ON "recipes"("quality_score" DESC);

-- CreateIndex
CREATE INDEX "recipe_ingredients_ingredient_id_idx" ON "recipe_ingredients"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_recipe_id_ingredient_id_key" ON "recipe_ingredients"("recipe_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "recipe_sources_recipe_id_idx" ON "recipe_sources"("recipe_id");

-- CreateIndex
CREATE INDEX "meal_logs_baby_id_eaten_at_idx" ON "meal_logs"("baby_id", "eaten_at" DESC);

-- CreateIndex
CREATE INDEX "meal_logs_baby_id_recipe_id_idx" ON "meal_logs"("baby_id", "recipe_id");

-- CreateIndex
CREATE INDEX "pantry_items_user_id_idx" ON "pantry_items"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pantry_items_user_id_ingredient_id_key" ON "pantry_items"("user_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_recipe_id_key" ON "favorites"("user_id", "recipe_id");

-- CreateIndex
CREATE INDEX "reports_recipe_id_idx" ON "reports"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_recipe_id_user_id_key" ON "reports"("recipe_id", "user_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "babies" ADD CONSTRAINT "babies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_substitute_id_fkey" FOREIGN KEY ("substitute_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_sources" ADD CONSTRAINT "recipe_sources_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
