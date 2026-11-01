import fs from "node:fs";
import { createHash } from "node:crypto";

// Produces reviewable, transactional DML. Execution is a separate explicit admin action.
const manifest = JSON.parse(fs.readFileSync("src/data/recipe-catalog-repair.json", "utf8"));
const baseline = JSON.parse(fs.readFileSync(".local-data/recipe-production-before.json", "utf8"));
const composition = JSON.parse(fs.readFileSync("src/data/food-composition.json", "utf8"));
const quoteJson = (data) => {
  const json = JSON.stringify(data);
  const delimiter =
    "$catalog_" + createHash("sha256").update(json).digest("hex").slice(0, 16) + "$";
  if (json.includes(delimiter)) throw new Error("Unsafe SQL delimiter");
  return delimiter + json + delimiter + "::jsonb";
};
fs.mkdirSync(".local-data/catalog-sql", { recursive: true });
fs.writeFileSync(
  ".local-data/catalog-sql/00-nutrition.sql",
  `BEGIN;
UPDATE ingredients i SET nutrition = n.value FROM jsonb_each(${quoteJson(composition)}) n WHERE i.slug = n.key;
SELECT count(*) AS mapped_ingredients FROM ingredients WHERE nutrition IS NOT NULL;
COMMIT;`,
);
const rows = manifest.recipes.map((r) => ({
  ...r,
  expectedUpdatedAt: r.id ? baseline.recipes.find((b) => b.id === r.id)?.updated_at : null,
  nutrition: { ...r.nutrition, catalogRepairVersion: manifest.version },
}));
for (let index = 0; index < rows.length; index += 8) {
  const input = quoteJson(rows.slice(index, index + 8));
  const sql = `BEGIN;
SET LOCAL lock_timeout = '5s';
DO $repair$
DECLARE item jsonb; ing jsonb; rid uuid; current_row recipes%ROWTYPE; src jsonb;
BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements(${input}) LOOP
    rid := COALESCE(item->>'id', item->>'newRecipeId')::uuid;
    SELECT * INTO current_row FROM recipes WHERE id = rid FOR UPDATE;
    IF FOUND AND current_row.nutrition->>'catalogRepairVersion' = item->'nutrition'->>'catalogRepairVersion' THEN CONTINUE; END IF;
    IF item->>'id' IS NOT NULL THEN
      IF current_row.id IS NULL OR current_row.updated_at <> (item->>'expectedUpdatedAt')::timestamp THEN
        RAISE EXCEPTION 'Recipe changed since backup: %', rid;
      END IF;
      IF current_row.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Recipe no longer active: %', rid; END IF;
      UPDATE recipes SET name=item->>'name', summary=item->>'summary', meal_role=item->>'mealRole',
        age_stages=ARRAY(SELECT value::integer FROM jsonb_array_elements_text(item->'ageStages')),
        allergens=ARRAY(SELECT value::"Allergen" FROM jsonb_array_elements_text(item->'allergens')),
        sodium_mg_per_serving=(item->>'sodiumMgPerServing')::integer,
        nutrition=item->'nutrition', updated_at=now() WHERE id=rid;
    ELSE
      IF current_row.id IS NOT NULL OR EXISTS(SELECT 1 FROM recipes WHERE slug=item->>'slug') THEN
        RAISE EXCEPTION 'New recipe already exists with different content: %', item->>'slug';
      END IF;
      INSERT INTO recipes(id,slug,name,summary,category,meal_role,meal_categories,age_stages,salt_level,cook_minutes,difficulty,tools,base_servings,sodium_mg_per_serving,allergens,steps,baby_tips,storage_info,status,quality_score,is_ai_generated,nutrition,generated_at,updated_at)
      VALUES(rid,item->>'slug',item->>'name',item->>'summary',(item->>'category')::"RecipeCategory",item->>'mealRole',
        ARRAY(SELECT value::"MealCategory" FROM jsonb_array_elements_text(item->'mealCategories')),
        ARRAY(SELECT value::integer FROM jsonb_array_elements_text(item->'ageStages')),
        (item->>'saltLevel')::"SaltLevel",(item->>'cookMinutes')::integer,(item->>'difficulty')::integer,
        ARRAY(SELECT value FROM jsonb_array_elements_text(item->'tools')),(item->>'baseServings')::integer,
        (item->>'sodiumMgPerServing')::integer,ARRAY(SELECT value::"Allergen" FROM jsonb_array_elements_text(item->'allergens')),
        item->'steps',item->'babyTips',item->'storageInfo','ACTIVE',0.75,true,item->'nutrition',now(),now());
      FOR ing IN SELECT value FROM jsonb_array_elements(item->'ingredients') LOOP
        IF NOT EXISTS(SELECT 1 FROM ingredients WHERE slug=ing->>'slug') THEN RAISE EXCEPTION 'Missing ingredient %', ing->>'slug'; END IF;
        INSERT INTO recipe_ingredients(id,recipe_id,ingredient_id,amount,unit,prep_note,is_optional,substitute_id)
          SELECT gen_random_uuid(),rid,i.id,(ing->>'amount')::double precision,ing->>'unit',ing->>'prepNote',
            (ing->>'isOptional')::boolean,(SELECT id FROM ingredients WHERE slug=ing->>'substituteSlug')
          FROM ingredients i WHERE i.slug=ing->>'slug';
      END LOOP;
    END IF;
    src := item->'source';
    IF src IS NOT NULL AND src <> 'null'::jsonb THEN
      UPDATE recipe_sources SET title=src->>'title', channel_or_site=src->>'channelOrSite',
        source_type=(src->>'sourceType')::"SourceType",trust_score=(src->>'trustScore')::double precision,
        verification_status='VERIFIED',verified_at=(src->>'verifiedAt')::timestamp WHERE recipe_id=rid AND url=src->>'url';
      INSERT INTO recipe_sources(id,recipe_id,url,title,channel_or_site,source_type,trust_score,verification_status,verified_at)
        SELECT gen_random_uuid(),rid,src->>'url',src->>'title',src->>'channelOrSite',(src->>'sourceType')::"SourceType",
          (src->>'trustScore')::double precision,'VERIFIED',(src->>'verifiedAt')::timestamp
        WHERE NOT EXISTS(SELECT 1 FROM recipe_sources WHERE recipe_id=rid AND url=src->>'url');
    END IF;
  END LOOP;
END $repair$;
SELECT count(*) AS repaired_recipes FROM recipes WHERE nutrition->>'catalogRepairVersion'='2026-11-01-catalog-repair-v1';
COMMIT;`;
  fs.writeFileSync(
    `.local-data/catalog-sql/${String(index / 8 + 1).padStart(2, "0")}-recipes.sql`,
    sql,
  );
}
fs.writeFileSync(
  ".local-data/catalog-sql/99-source-cleanup.sql",
  `BEGIN;
UPDATE recipe_sources SET verification_status='INVALID',verified_at=NULL,trust_score=0
 WHERE verification_status <> 'VERIFIED' AND (rtrim(url,'/') IN ('https://health.kdca.go.kr','https://www.foodsafetykorea.go.kr','https://koreanfood.rda.go.kr','https://www.seoulnutri.co.kr','https://www.childcare.go.kr') OR url LIKE '%/portal/healthyfoodlife/functionality.do?q=%');
SELECT count(*) AS invalid_sources FROM recipe_sources WHERE verification_status='INVALID';
COMMIT;`,
);
console.log(
  JSON.stringify({
    statements: Math.ceil(rows.length / 8) + 2,
    recipes: rows.length,
    manifestSha256: createHash("sha256")
      .update(fs.readFileSync("src/data/recipe-catalog-repair.json"))
      .digest("hex"),
  }),
);
