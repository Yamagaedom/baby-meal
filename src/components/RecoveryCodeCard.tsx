"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

interface RecoveryCodeCardProps {
  loginId: string;
  recoveryCode: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export function RecoveryCodeCard({
  loginId,
  recoveryCode,
  confirmLabel,
  onConfirm,
}: RecoveryCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [savedChecked, setSavedChecked] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // 클립보드 권한 제한 환경 대비
    }
  }

  function handleSaveImage() {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#fffbf7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#b4421a";
    ctx.lineWidth = 5;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    ctx.fillStyle = "#1f1a17";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText("오늘 뭐 먹지, 아가? — 1회용 계정 복구 코드", 44, 74);

    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#574c46";
    ctx.fillText(`계정 아이디: ${loginId}`, 44, 114);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(44, 138, canvas.width - 88, 84);
    ctx.strokeStyle = "#cfb8a5";
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 138, canvas.width - 88, 84);

    ctx.fillStyle = "#7c2d12";
    ctx.font = "bold 32px monospace";
    ctx.fillText(recoveryCode, 68, 192);

    ctx.fillStyle = "#991b1b";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(
      " 개인정보(이메일·전화번호) 미수집으로 이 코드 분실 시 계정을 복구할 수 없습니다.",
      44,
      264,
    );
    ctx.fillStyle = "#574c46";
    ctx.font = "14px sans-serif";
    ctx.fillText("타인에게 노출되지 않는 안전한 곳에 보관해 주세요.", 44, 296);

    const link = document.createElement("a");
    link.download = `baby-meal-recovery-${loginId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <section
      aria-labelledby="recovery-code-heading"
      className="space-y-4 rounded-lg border-2 border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-5"
    >
      <div>
        <h2
          id="recovery-code-heading"
          className="text-base font-semibold text-[var(--color-warning-text)]"
        >
          복구 코드가 발급되었습니다 (1회만 표시)
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-warning-text)]">
          본 서비스는 이메일·전화번호를 수집하지 않습니다. 비밀번호 분실 시 아래{" "}
          <strong>16자리 복구 코드</strong>로만 재설정할 수 있으며, 이 화면을 닫으면 다시 확인할 수
          없습니다.
        </p>
      </div>

      <div
        data-testid="recovery-code-display"
        className="rounded-md border-2 border-[var(--color-border-strong)] bg-white px-4 py-4 text-center font-mono text-xl font-semibold tracking-wider text-[var(--color-text)] select-all sm:text-2xl"
      >
        {recoveryCode}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <span>{copied ? "복사 완료!" : "복사"}</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleSaveImage}>
          <span>이미지로 저장</span>
        </Button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {copied ? "복구 코드가 클립보드에 복사되었습니다." : ""}
      </div>

      <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-md border border-[var(--color-border)] bg-white p-3.5 text-sm font-medium text-[var(--color-text)]">
        <input
          type="checkbox"
          data-testid="recovery-code-saved-checkbox"
          checked={savedChecked}
          onChange={(e) => setSavedChecked(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
        />
        <span>복구 코드를 안전한 곳에 저장했습니다. (저장했어요 확인 체크 후 이동 가능)</span>
      </label>

      <Button
        variant="primary"
        fullWidth
        data-testid="recovery-code-confirm-btn"
        disabled={!savedChecked}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </section>
  );
}
