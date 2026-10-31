import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFoundPage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-12"
    >
      <EmptyState
        title="찾으시는 페이지나 레시피가 없어요"
        description="주소가 변경되었거나 안전 정책에 의해 숨김 처리된 레시피일 수 있습니다."
        action={
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            홈 추천 화면으로 돌아가기
          </Link>
        }
      />
    </main>
  );
}
