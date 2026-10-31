import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:54329/template1?sslmode=disable",
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
