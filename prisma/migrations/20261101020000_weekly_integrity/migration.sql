ALTER TABLE "recipes" ADD COLUMN "meal_role" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "food_batches" ADD CONSTRAINT "food_batches_remaining_check" CHECK (remaining >= 0);
ALTER TABLE "food_batches" ADD CONSTRAINT "food_batches_dates_check" CHECK (expires_date IS NULL OR expires_date >= prepared_date);
ALTER TABLE "food_reservations" ADD CONSTRAINT "food_reservations_servings_check" CHECK (servings > 0);
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_servings_check" CHECK (servings BETWEEN 1 AND 5);
ALTER TABLE "cooking_tasks" ADD CONSTRAINT "cooking_tasks_servings_check" CHECK (servings BETWEEN 1 AND 5);
UPDATE "recipe_sources" SET verification_status = 'INVALID', trust_score = 0
WHERE url LIKE '%seed-placeholder%' OR url LIKE '%functionality.do?q=%' OR url LIKE '%board.do?q=%';
