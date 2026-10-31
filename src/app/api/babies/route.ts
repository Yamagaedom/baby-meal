import { type NextRequest, NextResponse } from "next/server";
import {
  getActiveBabyIdCookie,
  requireApiUser,
  setActiveBabyIdCookie,
} from "@/features/auth";
import {
  createBabyProfile,
  listBabyProfiles,
  resolveActiveBabyProfile,
} from "@/features/profile";
import { toErrorResponse } from "@/lib/http/errors";

export async function GET() {
  try {
    const user = await requireApiUser();
    const cookieBabyId = await getActiveBabyIdCookie();
    const [babies, activeBaby] = await Promise.all([
      listBabyProfiles(user.id),
      resolveActiveBabyProfile(user.id, { cookieBabyId }),
    ]);

    return NextResponse.json({
      babies,
      activeBabyId: activeBaby?.id ?? null,
    });
  } catch (error) {
    return toErrorResponse(error, "GET /api/babies");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const result = await createBabyProfile(user.id, body);

    await setActiveBabyIdCookie(result.baby.id);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "POST /api/babies");
  }
}
