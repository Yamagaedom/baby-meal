import "dotenv/config";
import fs from "node:fs";
import { Client } from "pg";

// Exercise the exact production DML in temporary tables on LOCAL PostgreSQL only.
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Local database required");
const client = new Client({ connectionString: url.toString() });
const backup = JSON.parse(fs.readFileSync(".local-data/recipe-production-before.json", "utf8"));
const queries = fs
  .readdirSync(".local-data/catalog-sql")
  .sort()
  .map((name) => fs.readFileSync(".local-data/catalog-sql/" + name, "utf8"));
await client.connect();
try {
  // Prisma dev's embedded server can retain temporary objects across client reconnects.
  for (const table of ["recipe_sources", "recipe_ingredients", "recipes", "ingredients"]) {
    await client.query(`DROP TABLE IF EXISTS pg_temp.${table}`);
  }
  for (const table of ["ingredients", "recipes", "recipe_ingredients", "recipe_sources"]) {
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
    const resolved = (
      await client.query(
        "SELECT $1::regclass::oid = c.oid AS is_temp FROM pg_class c WHERE c.oid=$1::regclass AND c.relnamespace=pg_my_temp_schema()",
        [table],
      )
    ).rows[0];
    if (!resolved?.is_temp) throw new Error("Unsafe table resolution");
  }
  const data = {
    ingredients: backup.ingredients,
    recipes: backup.recipes,
    recipe_ingredients: backup.recipes.flatMap((r) => r.ingredients),
    recipe_sources: backup.recipes.flatMap((r) => r.sources ?? []),
  };
  for (const [table, rows] of Object.entries(data)) {
    await client.query(
      `INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`,
      [JSON.stringify(rows)],
    );
  }
  const audit = async () => ({
    total: Number((await client.query("SELECT count(*) FROM recipes")).rows[0].count),
    verified: Number(
      (
        await client.query(
          "SELECT count(*) FROM recipes r WHERE EXISTS(SELECT 1 FROM recipe_sources s WHERE s.recipe_id=r.id AND s.verification_status='VERIFIED')",
        )
      ).rows[0].count,
    ),
    profiles: (
      await client.query(`SELECT stage,salt, count(*) FILTER(WHERE r.status='ACTIVE' AND stage=ANY(r.age_stages) AND (r.salt_level::text='NONE' OR salt='LOW' AND r.salt_level::text='LOW'))::int AS visible,
      count(*) FILTER(WHERE r.status='ACTIVE' AND stage=ANY(r.age_stages) AND (r.salt_level::text='NONE' OR salt='LOW' AND r.salt_level::text='LOW') AND r.meal_role='MAIN' AND EXISTS(SELECT 1 FROM recipe_sources s WHERE s.recipe_id=r.id AND s.verification_status='VERIFIED'))::int AS weekly_main
      FROM generate_series(1,4) stage CROSS JOIN (VALUES('NONE'),('LOW')) salts(salt) CROSS JOIN recipes r GROUP BY stage,salt ORDER BY stage,salt`)
    ).rows,
  });
  const before = await audit();
  for (const query of queries) await client.query(query);
  const after = await audit();
  if (after.total !== 143 || after.verified !== 125)
    throw new Error("Unexpected repaired counts: " + JSON.stringify(after));
  if (
    (
      await client.query("SELECT count(*) FROM recipes WHERE id=ANY($1::uuid[])", [
        backup.recipes.map((r) => r.id),
      ])
    ).rows[0].count !== "60"
  )
    throw new Error("Existing recipe lost");
  const sourceCount = (await client.query("SELECT count(*) FROM recipe_sources")).rows[0].count;
  for (const query of queries) await client.query(query);
  if (
    (await audit()).total !== 143 ||
    (await client.query("SELECT count(*) FROM recipe_sources")).rows[0].count !== sourceCount
  )
    throw new Error("Repair is not idempotent");
  const report = { before, after, idempotent: true, existingRecipeIdsPreserved: true };
  fs.writeFileSync(
    ".local-data/catalog-quality-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await client.query("ROLLBACK");
  for (const table of ["recipe_sources", "recipe_ingredients", "recipes", "ingredients"])
    await client.query(`DROP TABLE IF EXISTS pg_temp.${table}`);
  await client.end();
}
