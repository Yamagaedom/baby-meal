import { NextResponse } from "next/server";
import { getAiQuotaStatus } from "@/features/ai-generation";
import { requireApiUser } from "@/features/auth";
import { toErrorResponse } from "@/lib/http/errors";

export async function GET() {
  try {
    const user = await requireApiUser();
    const quota = await getAiQuotaStatus(user.id);
    return NextResponse.json({ quota });
  } catch (error) {
    return toErrorResponse(error, "GET /api/ai/quota");
  }
}
