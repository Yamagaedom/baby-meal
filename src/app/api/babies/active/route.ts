import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, setActiveBabyIdCookie } from "@/features/auth";
import { getOwnedBabyOrThrow } from "@/features/profile";
import { toErrorResponse } from "@/lib/http/errors";

const setActiveSchema = z.object({
  babyId: z.string().uuid("올바른 아기 프로필 ID가 아닙니다."),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = setActiveSchema.parse(await request.json());
    const baby = await getOwnedBabyOrThrow(user.id, body.babyId);

    await setActiveBabyIdCookie(baby.id);

    return NextResponse.json({ activeBabyId: baby.id, baby });
  } catch (error) {
    return toErrorResponse(error, "POST /api/babies/active");
  }
}
