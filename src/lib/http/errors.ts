import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * 사용자용 한국어 메시지와 내부 로그를 분리하는 애플리케이션 에러
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly userMessage: string;

  constructor(status: number, code: string, userMessage: string, internalMessage?: string) {
    super(internalMessage ?? userMessage);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.userMessage = userMessage;
  }
}

export function toErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.userMessage,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    const firstMessage = error.issues[0]?.message ?? "입력값이 올바르지 않습니다.";
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: firstMessage,
          issues: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "요청 본문(JSON) 형식이 올바르지 않습니다.",
        },
      },
      { status: 400 },
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2023"
  ) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_ID",
          message: "올바른 식별자 형식이 아닙니다.",
        },
      },
      { status: 400 },
    );
  }

  console.error(`[${context}] 내부 서버 오류:`, error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
    },
    { status: 500 },
  );
}
