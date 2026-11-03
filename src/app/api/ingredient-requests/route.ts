import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/features/auth";
import { getPrisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/http/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const { name } = z
      .object({ name: z.string().trim().min(1).max(40) })
      .parse(await request.json());
    await getPrisma().ingredientRequest.upsert({
      where: { userId_name: { userId: user.id, name } },
      create: { userId: user.id, name },
      update: {},
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return toErrorResponse(error, "POST /api/ingredient-requests");
  }
}
