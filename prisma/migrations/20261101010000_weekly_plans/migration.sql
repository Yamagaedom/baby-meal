-- AlterTable
ALTER TABLE "ingredients" ADD COLUMN     "nutrition" JSONB;

-- AlterTable
ALTER TABLE "recipe_sources" ADD COLUMN     "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "meal_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "baby_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "preferences" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_entries" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "meal_time" "MealCategory" NOT NULL,
    "slot_index" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'HOME',
    "recipe_id" UUID,
    "name" TEXT NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "served" BOOLEAN NOT NULL DEFAULT false,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "meal_plan_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooking_tasks" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "servings" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cooking_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_batches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recipe_id" UUID,
    "task_id" UUID,
    "name" TEXT NOT NULL,
    "category" "RecipeCategory" NOT NULL,
    "location" TEXT NOT NULL,
    "prepared_date" DATE NOT NULL,
    "expires_date" DATE,
    "remaining" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_reservations" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "servings" INTEGER NOT NULL,

    CONSTRAINT "food_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_movements" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_plans_user_id_baby_id_start_date_idx" ON "meal_plans"("user_id", "baby_id", "start_date");

-- CreateIndex
CREATE INDEX "meal_plan_entries_recipe_id_idx" ON "meal_plan_entries"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_entries_plan_id_date_meal_time_slot_index_positio_key" ON "meal_plan_entries"("plan_id", "date", "meal_time", "slot_index", "position");

-- CreateIndex
CREATE UNIQUE INDEX "food_batches_task_id_key" ON "food_batches"("task_id");

-- CreateIndex
CREATE INDEX "food_batches_user_id_expires_date_idx" ON "food_batches"("user_id", "expires_date");

-- CreateIndex
CREATE INDEX "food_reservations_entry_id_idx" ON "food_reservations"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "food_reservations_batch_id_entry_id_key" ON "food_reservations"("batch_id", "entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "food_movements_event_key_key" ON "food_movements"("event_key");

-- CreateIndex
CREATE INDEX "food_movements_batch_id_idx" ON "food_movements"("batch_id");

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_tasks" ADD CONSTRAINT "cooking_tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_batches" ADD CONSTRAINT "food_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_reservations" ADD CONSTRAINT "food_reservations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "food_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_reservations" ADD CONSTRAINT "food_reservations_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "meal_plan_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_movements" ADD CONSTRAINT "food_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "food_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
