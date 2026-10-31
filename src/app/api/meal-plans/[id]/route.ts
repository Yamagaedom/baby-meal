import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/features/auth";
import { changePlan } from "@/features/meal-plan/service";
import { requireActiveBabyForApi } from "@/features/profile/api-helper";
import { toErrorResponse } from "@/lib/http/errors";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const baby = await requireActiveBabyForApi(user.id, body.babyId);
    const id = z
      .string()
      .uuid()
      .parse((await params).id);
    return NextResponse.json(await changePlan(user.id, baby, id, body));
  } catch (error) {
    return toErrorResponse(error, "PATCH /api/meal-plans/[id]");
  }
}
