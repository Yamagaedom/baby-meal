import "dotenv/config";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Client } from "pg";

function prisma(...args: string[]) {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) throw new Error("Database deployment command failed.");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  const client = new Client({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
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
  prisma("generate");
}
main().catch(() => {
  console.error("Database migration failed. No credentials logged.");
  process.exit(1);
});
