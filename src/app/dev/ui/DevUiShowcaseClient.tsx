"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  RecipeCardSkeleton,
  Select,
  Stepper,
  Tabs,
  useToast,
} from "@/components/ui";

export function DevUiShowcaseClient() {
  const { showToast } = useToast();
  const [servings, setServings] = useState(2);
  const [tab, setTab] = useState<"all" | "meal" | "snack">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [chipSelected, setChipSelected] = useState(true);

  return (
    <main id="main-content" className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="rounded-lg border border-[var(--color-border)] bg-white p-6">
        <Badge variant="primary">개발 전용 디자인 시스템 쇼케이스 (/dev/ui)</Badge>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
          오늘 뭐 먹지, 아가? — UI 컴포넌트 카탈로그
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          WCAG 2.1 AA 명도 대비(4.5:1+), 최소 터치 영역(44×44px), 키보드 내비게이션을 준수하는 공용
          컴포넌트 목록입니다.
        </p>
      </header>

      <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-6">
        <h2 className="text-lg font-semibold">1. Buttons & Toast</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => showToast("저장되었습니다!", "success")}>
            Primary 버튼 (토스트 실행)
          </Button>
          <Button variant="secondary">Secondary 버튼</Button>
          <Button variant="outline">Outline 버튼</Button>
          <Button variant="ghost">Ghost 버튼</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Danger 버튼 (확인 모달)
          </Button>
          <Button disabled>Disabled 버튼</Button>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-6">
        <h2 className="text-lg font-semibold">2. Badges & Chips</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="primary">식사</Badge>
          <Badge variant="ai">AI 생성</Badge>
          <Badge variant="age">완료기 (12~15개월)</Badge>
          <Badge variant="salt">무염</Badge>
          <Badge variant="rating">잘 먹었어요 3회</Badge>
          <Badge variant="allergy">알레르기 주의: 달걀</Badge>
          <Badge variant="warning">높은 월령 단계 주의</Badge>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Chip selected={chipSelected} onClick={() => setChipSelected((v) => !v)}>
            애호박 (선택 토글)
          </Chip>
          <Chip onRemove={() => showToast("칩 제거됨")} removeLabel="당근 제거">
            당근
          </Chip>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-[var(--color-border)] bg-white p-6 md:grid-cols-2">
        <Input
          label="식재료 검색 입력란"
          hint="동의어(예: 계란 → 달걀)도 함께 검색됩니다."
          placeholder="예: 단호박"
        />
        <Input
          label="오류 상태 입력란"
          defaultValue="ab"
          error="아이디는 영문 소문자·숫자 4~20자로 입력해 주세요."
        />
        <Select label="현재 월령 선택" defaultValue="15">
          <option value="15">15개월 (완료기)</option>
          <option value="20">20개월 (유아식 1단계)</option>
        </Select>
      </section>

      <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-6">
        <h2 className="text-lg font-semibold">3. Stepper (1~5회분) & Tabs & Modal</h2>
        <Stepper value={servings} onChange={setServings} />
        <Tabs
          ariaLabel="카테고리 탭 예시"
          value={tab}
          onChange={setTab}
          options={[
            { id: "all", label: "전체" },
            { id: "meal", label: "식사" },
            { id: "snack", label: "간식" },
          ]}
        />
        <div>
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            포커스 트랩 모달 열기 (ESC 닫기 지원)
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-6">
        <h2 className="text-lg font-semibold">4. Empty / Skeleton / Error States</h2>
        <EmptyState
          title="조건에 맞는 레시피가 없어요"
          description="다른 식재료를 선택하거나 필터를 초기화해 보세요."
        />
        <RecipeCardSkeleton count={2} />
        <ErrorState
          message="네트워크 연결이 불안정합니다."
          onRetry={() => showToast("다시 시도합니다.")}
        />
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="모달 접근성 테스트">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Tab / Shift+Tab 키로 포커스가 대화상자 내부에 갇히며, ESC 키를 누르면 닫히고 원래 버튼으로
          포커스가 복귀합니다.
        </p>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="정말 삭제하시겠어요?"
        description="삭제된 항목은 되돌릴 수 없습니다."
        confirmLabel="삭제 확인"
        onConfirm={() => {
          setConfirmOpen(false);
          showToast("삭제 확인 완료", "warning");
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}
