import "dotenv/config";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Client } from "pg";

function prisma(...args: string[]) {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
    stdio: "inherit",
    env: process.env,
    timeout: 120_000,
  });
  if (result.status !== 0) throw new Error("Database deployment command failed.");
}

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  const migrationUrl = new URL(url);
  const supabase =
    migrationUrl.hostname.endsWith(".pooler.supabase.com") ||
    migrationUrl.hostname.endsWith(".supabase.co");
  if (migrationUrl.hostname.endsWith(".pooler.supabase.com") && migrationUrl.port === "6543")
    migrationUrl.port = "5432";
  migrationUrl.searchParams.delete("pgbouncer");
  process.env.DATABASE_URL = migrationUrl.toString();
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(migrationUrl.hostname);
  const client = new Client({
    connectionString: migrationUrl.toString(),
    ssl: local ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    query_timeout: 15000,
  });
  await client.connect();
  try {
    const metadata = await client.query(
      "SELECT to_regclass('public._prisma_migrations') AS migrations, to_regclass('public.users') AS users",
    );
    if (!metadata.rows[0].migrations && metadata.rows[0].users) {
      // The existing production database was provisioned with db push. Check every original
      // table and column before recording that original migration as already present.
      const original = readFileSync("prisma/migrations/20261031061109_init/migration.sql", "utf8");
      const columns = await client.query(
        "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",
      );
      const actual = new Set(columns.rows.map((r) => `${r.table_name}.${r.column_name}`));
      for (const match of original.matchAll(/CREATE TABLE "([^"]+)" \(([\s\S]*?)\n\);/g)) {
        for (const col of match[2].matchAll(/^\s+"([^"]+)" /gm))
          if (!actual.has(`${match[1]}.${col[1]}`))
            throw new Error(
              "Existing schema does not match the initial migration; baseline refused.",
            );
      }
      prisma("migrate", "resolve", "--applied", "20261031061109_init");
    }
  } finally {
    await client.end();
  }
  prisma("migrate", "deploy");
  if (supabase) {
    const protection = new Client({
      connectionString: migrationUrl.toString(),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      query_timeout: 15000,
    });
    await protection.connect();
    try {
      await protection.query("BEGIN");
      for (const table of [
        "users",
        "sessions",
        "ai_usages",
        "babies",
        "allergies",
        "ingredients",
        "recipes",
        "recipe_ingredients",
        "recipe_sources",
        "meal_logs",
        "pantry_items",
        "favorites",
        "reports",
        "_prisma_migrations",
        "meal_plans",
        "meal_plan_entries",
        "cooking_tasks",
        "food_batches",
        "food_reservations",
        "food_movements",
        "recipe_reviews",
      ]) {
        // This app uses server-side sessions, not Supabase Auth JWTs. No public Data API policy.
        await protection.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
        await protection.query(
          `REVOKE ALL ON TABLE public.${table} FROM anon, authenticated, PUBLIC`,
        );
      }
      await protection.query("COMMIT");
      console.log(
        "Server-managed application tables: RLS enabled; direct Data API access revoked.",
      );
    } catch (error) {
      await protection.query("ROLLBACK");
      throw error;
    } finally {
      await protection.end();
    }
  }
  prisma("generate");
}
main().catch(() => {
  console.error("Database migration failed. No credentials logged.");
  process.exit(1);
});
