/**
 * Prisma Client 싱글턴 (Prisma 7 + @prisma/adapter-pg)
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prismaPool?: Pool;
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 환경 변수가 설정되지 않았습니다.");
  }

  // 로컬 Prisma Dev(PGlite 단일 세션 프록시)는 max=1, Vercel 서버리스는 동시 인스턴스 고려 max=3, 일반 서버는 max=10
  const databaseUrl = new URL(connectionString);
  const isLocalPrismaDev =
    ["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname) &&
    databaseUrl.pathname === "/template1";
  const isVercelServerless = Boolean(process.env.VERCEL);
  const defaultMax = isLocalPrismaDev ? 1 : isVercelServerless ? 3 : 10;
  const poolMax = process.env.PG_POOL_MAX ? Number(process.env.PG_POOL_MAX) : defaultMax;

  const pool =
    globalForPrisma.prismaPool ??
    new Pool({
      connectionString,
      max: poolMax,
    });

  globalForPrisma.prismaPool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}
