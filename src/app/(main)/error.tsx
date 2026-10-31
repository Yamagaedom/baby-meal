"use client";

import { ErrorState } from "@/components/ui";

export default function MainError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-8">
      <ErrorState
        title="일시적인 화면 오류가 발생했어요"
        message="데이터를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
        onRetry={reset}
      />
    </div>
  );
}
