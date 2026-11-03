ALTER TABLE meal_plan_entries ALTER COLUMN servings TYPE DOUBLE PRECISION;
ALTER TABLE cooking_tasks ALTER COLUMN servings TYPE DOUBLE PRECISION;
ALTER TABLE food_batches ALTER COLUMN remaining TYPE DOUBLE PRECISION;
ALTER TABLE food_reservations ALTER COLUMN servings TYPE DOUBLE PRECISION;
ALTER TABLE food_movements ALTER COLUMN delta TYPE DOUBLE PRECISION;
CREATE TABLE ingredient_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id, name)
);
ALTER TABLE ingredient_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ingredient_requests FROM anon, authenticated, PUBLIC;
