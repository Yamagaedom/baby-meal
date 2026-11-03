ALTER TABLE meal_plan_entries DROP CONSTRAINT IF EXISTS meal_plan_entries_servings_check;
ALTER TABLE meal_plan_entries ADD CONSTRAINT meal_plan_entries_servings_check CHECK (servings >= 0.1 AND servings <= 5);
ALTER TABLE cooking_tasks DROP CONSTRAINT IF EXISTS cooking_tasks_servings_check;
ALTER TABLE cooking_tasks ADD CONSTRAINT cooking_tasks_servings_check CHECK (servings >= 0.1 AND servings <= 5);
