import { type NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/features/auth";
import { submitRecipeReport } from "@/features/report";
import { toErrorResponse } from "@/lib/http/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json();
    const result = await submitRecipeReport(user.id, id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "POST /api/recipes/[id]/report");
  }
}
