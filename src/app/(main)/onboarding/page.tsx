"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BabyProfileForm } from "@/components/BabyProfileForm";
import { Badge, Button } from "@/components/ui";

export default function OnboardingPage() {
  const router = useRouter();
  const [warnings, setWarnings] = useState<string[]>([]);

  function handleSuccess(_babyId: string, nextWarnings: string[]) {
    if (nextWarnings.length > 0) {
      setWarnings(nextWarnings);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-none sm:p-8">
      <div aria-label="온보딩 진행 단계" className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="success">1. 계정 생성 완료</Badge>
        <Badge variant="success">2. 복구 코드 보관 완료</Badge>
        <Badge variant="primary">3. 아기 프로필 등록</Badge>
      </div>

      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-[var(--color-text)] sm:text-[32px]">
        아기 프로필 등록
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        아기의 현재 월령, 간 단계, 알레르기 정보를 설정하면 안전 기준을 통과한 맞춤 유아식과 간식을
        바로 추천해 드립니다. 알레르기가 없으면 건너뛰셔도 됩니다.
      </p>

      {warnings.length > 0 ? (
        <div className="mt-6 space-y-4">
          <div
            role="status"
            className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-4 text-sm text-[var(--color-warning-text)]"
          >
            <p className="font-semibold">프로필이 저장되었으나 확인이 필요한 항목이 있습니다.</p>
            <ul className="mt-2 list-disc pl-5 text-xs leading-relaxed">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
          <Button
            fullWidth
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
          >
            확인 후 홈으로 이동
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <BabyProfileForm submitLabel="시작하기" onSuccess={handleSuccess} />
        </div>
      )}
    </div>
  );
}
