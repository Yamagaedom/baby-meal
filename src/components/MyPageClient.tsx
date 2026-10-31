"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BabyProfileForm } from "@/components/BabyProfileForm";
import { RecoveryCodeCard } from "@/components/RecoveryCodeCard";
import { Badge, Button, Chip, ConfirmDialog, Input } from "@/components/ui";
import type { BabyProfileView } from "@/features/profile";
import { SALT_LEVEL_LABELS } from "@/features/recipe/constants-client";
import type { Allergen } from "@/lib/domain/types";
import { clearAllOfflineFavorites, removeOfflineFavoritesForBaby } from "@/lib/offline-favorites";

interface MyPageClientProps {
  loginId: string;
  babies: BabyProfileView[];
}

export function MyPageClient({ loginId, babies }: MyPageClientProps) {
  const router = useRouter();
  const [editingBabyId, setEditingBabyId] = useState<string | null>(null);
  const [addingBaby, setAddingBaby] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [deletingBabyTarget, setDeletingBabyTarget] = useState<BabyProfileView | null>(null);

  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  // 복구 코드 재발급
  const [reissuePassword, setReissuePassword] = useState("");
  const [reissuedCode, setReissuedCode] = useState<string | null>(null);
  const [reissueError, setReissueError] = useState<string | null>(null);

  // 회원 탈퇴 (2단계 확인)
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleLogout() {
    clearAllOfflineFavorites();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function confirmDeleteBaby() {
    if (!deletingBabyTarget) return;
    const deletedId = deletingBabyTarget.id;
    const res = await fetch(`/api/babies/${deletedId}`, { method: "DELETE" });
    setDeletingBabyTarget(null);
    if (res.ok) {
      removeOfflineFavoritesForBaby(deletedId);
      setProfileNotice("아기 프로필이 삭제되었습니다.");
      router.refresh();
    }
  }

  async function handleRemoveAllergyItem(babyId: string, allergyId: string) {
    const res = await fetch(`/api/babies/${babyId}/allergies/${allergyId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.refresh();
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwMessage(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPwError(data?.error?.message ?? "비밀번호 변경에 실패했습니다.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setPwMessage("비밀번호가 변경되었습니다.");
  }

  async function handleReissueRecoveryCode(e: React.FormEvent) {
    e.preventDefault();
    setReissueError(null);
    const res = await fetch("/api/auth/recovery-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: reissuePassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setReissueError(data?.error?.message ?? "복구 코드 재발급에 실패했습니다.");
      return;
    }
    setReissuePassword("");
    setReissuedCode(data.recoveryCode);
  }

  function handleOpenDeleteConfirm(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    if (!deletePassword.trim()) {
      setDeleteError("현재 비밀번호를 입력해 주세요.");
      return;
    }
    setDeleteModalOpen(true);
  }

  async function executeAccountDeletion() {
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteModalOpen(false);
        setDeleteError(data?.error?.message ?? "계정 삭제에 실패했습니다.");
        return;
      }
      clearAllOfflineFavorites();
      setDeleteModalOpen(false);
      router.push("/login");
      router.refresh();
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 아기 프로필 관리 섹션 */}
      <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-[var(--color-text)] sm:text-[32px]">
              아기 프로필 관리
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              최대 5명까지 등록·전환할 수 있습니다. ({babies.length}/5)
            </p>
          </div>
          {babies.length < 5 && !addingBaby && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setAddingBaby(true);
                setEditingBabyId(null);
              }}
            >
              + 아기 프로필 추가
            </Button>
          )}
        </div>

        {profileNotice && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] p-3.5 text-sm font-semibold text-[var(--color-secondary-text)]"
          >
            <span aria-hidden="true">✓ </span>
            {profileNotice}
          </div>
        )}

        {addingBaby && (
          <div className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-canvas)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                새 아기 프로필 추가
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setAddingBaby(false)}>
                취소
              </Button>
            </div>
            <BabyProfileForm
              submitLabel="프로필 추가"
              onSuccess={(_id, warnings) => {
                setAddingBaby(false);
                setProfileNotice(
                  warnings.length > 0 ? warnings.join(" ") : "새 아기 프로필이 등록되었습니다.",
                );
                router.refresh();
              }}
            />
          </div>
        )}

        <div className="space-y-3.5">
          {babies.map((b) => {
            const isEditing = editingBabyId === b.id;
            const confirmedAllergens = b.allergies
              .filter((a) => a.status === "CONFIRMED" && a.allergenType)
              .map((a) => a.allergenType as Allergen);
            const confirmedIngredients = b.allergies
              .filter((a) => a.status === "CONFIRMED" && a.ingredientId && a.ingredientName)
              .map((a) => ({ id: a.ingredientId!, name: a.ingredientName! }));

            return (
              <div
                key={b.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                      {b.displayName}
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="age">
                        현재 {b.currentAgeMonth}개월 ({b.ageStageLabel})
                      </Badge>
                      <Badge variant="salt">{SALT_LEVEL_LABELS[b.saltLevel]}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingBabyId(isEditing ? null : b.id);
                        setAddingBaby(false);
                      }}
                    >
                      {isEditing ? "닫기" : "수정"}
                    </Button>
                    {babies.length > 1 && (
                      <Button variant="danger" size="sm" onClick={() => setDeletingBabyTarget(b)}>
                        삭제
                      </Button>
                    )}
                  </div>
                </div>

                {b.allergies.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      등록된 알레르기 및 주의(의심) 항목
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {b.allergies.map((a) => (
                        <Chip
                          key={a.id}
                          tone={a.status === "SUSPECTED" ? "warning" : "danger"}
                          onRemove={() => void handleRemoveAllergyItem(b.id, a.id)}
                          removeLabel={`${a.label} 알레르기 항목 삭제`}
                        >
                          {a.label} {a.status === "SUSPECTED" ? "(의심)" : "(확정)"}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                {isEditing && (
                  <div className="mt-5 border-t border-[var(--color-border)] pt-5">
                    <BabyProfileForm
                      initial={{
                        id: b.id,
                        nickname: b.nickname,
                        ageMonth: Math.min(48, Math.max(12, b.currentAgeMonth)),
                        saltLevel: b.saltLevel,
                        allergens: confirmedAllergens,
                        ingredientItems: confirmedIngredients,
                      }}
                      submitLabel="변경사항 저장"
                      onSuccess={(_id, warnings) => {
                        setEditingBabyId(null);
                        setProfileNotice(
                          warnings.length > 0 ? warnings.join(" ") : "프로필이 수정되었습니다.",
                        );
                        router.refresh();
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 계정 관리 섹션 */}
      <section className="space-y-6 rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold break-all text-[var(--color-text)]">
              계정 관리 ({loginId})
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              개인정보 미수집 안심 계정입니다.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
            로그아웃
          </Button>
        </div>

        {/* 비밀번호 변경 */}
        <form
          onSubmit={handleChangePassword}
          className="space-y-4 border-t border-[var(--color-border)] pt-5"
        >
          <h3 className="text-base font-semibold text-[var(--color-text)]">비밀번호 변경</h3>
          {pwMessage && (
            <div
              role="status"
              className="rounded-md border border-[var(--color-success-border)] bg-[var(--color-success-soft)] p-3 text-xs font-semibold text-[var(--color-secondary-text)]"
            >
              ✓ {pwMessage}
            </div>
          )}
          {pwError && (
            <div
              role="alert"
              className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-3 text-xs font-semibold text-[var(--color-danger-text)]"
            >
              {pwError}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="password"
              required
              label="현재 비밀번호"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              type="password"
              required
              label="새 비밀번호"
              placeholder="영문+숫자 8자 이상"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm">
            비밀번호 변경
          </Button>
        </form>

        {/* 복구 코드 재발급 */}
        <div className="space-y-3 border-t border-[var(--color-border)] pt-5">
          <h3 className="text-base font-semibold text-[var(--color-text)]">복구 코드 재발급</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            재발급 시 기존 복구 코드는 즉시 무효화됩니다.
          </p>
          {reissuedCode ? (
            <RecoveryCodeCard
              loginId={loginId}
              recoveryCode={reissuedCode}
              confirmLabel="확인 완료"
              onConfirm={() => setReissuedCode(null)}
            />
          ) : (
            <form onSubmit={handleReissueRecoveryCode} className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 basis-56">
                <Input
                  type="password"
                  required
                  label="복구 코드 재발급용 현재 비밀번호"
                  error={reissueError}
                  placeholder="현재 비밀번호 확인"
                  value={reissuePassword}
                  onChange={(e) => setReissuePassword(e.target.value)}
                />
              </div>
              <Button type="submit" variant="outline">
                새 복구 코드 발급
              </Button>
            </form>
          )}
        </div>

        {/* 회원 탈퇴 — 2단계 확인 (ACC-07) */}
        <form
          onSubmit={handleOpenDeleteConfirm}
          className="space-y-4 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)]/60 p-4 sm:p-5"
        >
          <div>
            <h3 className="text-base font-semibold text-[var(--color-danger-text)]">
              회원 탈퇴 (즉시 영구 삭제 · 2단계 확인)
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-danger-text)]">
              탈퇴 즉시 계정, 아기 프로필, 먹은 기록, 즐겨찾기, 내 냉장고 데이터가 복구 불가능하게
              영구 삭제됩니다.
            </p>
          </div>

          <Input
            type="password"
            required
            label="회원 탈퇴 확인용 현재 비밀번호"
            error={deleteError}
            placeholder="현재 비밀번호 입력"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />

          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={deleteConfirmChecked}
              onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[var(--color-danger)]"
            />
            <span className="min-w-0">
              모든 데이터가 즉시 영구 삭제됨을 확인했습니다. (1단계 동의)
            </span>
          </label>

          <Button type="submit" variant="danger" size="sm" disabled={!deleteConfirmChecked}>
            회원 탈퇴
          </Button>
        </form>
      </section>

      <ConfirmDialog
        open={Boolean(deletingBabyTarget)}
        title="아기 프로필을 삭제할까요?"
        description={
          deletingBabyTarget
            ? `'${deletingBabyTarget.displayName}' 프로필과 연결된 먹은 기록·알레르기 정보가 함께 삭제되며 되돌릴 수 없습니다.`
            : ""
        }
        confirmLabel="프로필 삭제"
        onConfirm={() => void confirmDeleteBaby()}
        onCancel={() => setDeletingBabyTarget(null)}
      />

      <ConfirmDialog
        open={deleteModalOpen}
        title="정말 계정을 영구 탈퇴하시겠어요? (최종 확인)"
        description={`'${loginId}' 계정의 모든 아기 프로필, 알레르기 설정, 식단 기록, 즐겨찾기가 즉시 파기되며 절대 복구할 수 없습니다.`}
        confirmLabel="영구 탈퇴 실행"
        loading={deleteSubmitting}
        onConfirm={() => void executeAccountDeletion()}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}
