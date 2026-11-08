-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SocialProvider') THEN
    CREATE TYPE "SocialProvider" AS ENUM ('KAKAO', 'GOOGLE', 'NAVER');
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- CreateTable
CREATE TABLE IF NOT EXISTS "social_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "display_name" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_accounts_user_id_idx" ON "social_accounts"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_accounts_email_idx" ON "social_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_accounts_provider_provider_user_id_key" ON "social_accounts"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_accounts_user_id_provider_key" ON "social_accounts"("user_id", "provider");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'social_accounts_user_id_fkey'
  ) THEN
    ALTER TABLE "social_accounts"
      ADD CONSTRAINT "social_accounts_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
