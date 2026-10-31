import { getActiveBabyIdCookie } from "@/features/auth";
import { type BabyProfileView, resolveActiveBabyProfile } from "@/features/profile";
import { AppError } from "@/lib/http/errors";

export async function requireActiveBabyForApi(
  userId: string,
  explicitBabyId?: string | null,
): Promise<BabyProfileView> {
  const cookieBabyId = await getActiveBabyIdCookie();
  const baby = await resolveActiveBabyProfile(userId, {
    explicitBabyId,
    cookieBabyId,
  });

  if (!baby) {
    throw new AppError(400, "NO_BABY_PROFILE", "먼저 아기 프로필을 등록해 주세요.");
  }

  return baby;
}
