"use client";

import { useEffect, useState } from "react";
import { Button, Chip, Input, Select } from "@/components/ui";
import { SALT_LEVEL_LABELS } from "@/features/recipe/constants-client";
import {
  MAX_AGE_MONTH,
  MIN_AGE_MONTH,
  ageMonthsFromBirthDate,
  defaultSaltLevelForAge,
  getAgeStage,
  getAgeStageInfo,
  kstDateString,
  parseKstDate,
} from "@/lib/age";
import { ALLERGENS, ALLERGEN_LABELS, type Allergen, type SaltLevel } from "@/lib/domain/types";
import { isValidCalendarDateString } from "@/lib/validation";

interface IngredientOption {
  id: string;
  name: string;
  synonyms: string[];
}

export interface BabyProfileFormInitial {
  id?: string;
  nickname?: string | null;
  birthDate?: string | null;
  ageMonth?: number;
  saltLevel?: SaltLevel;
  allergens?: Allergen[];
  ingredientItems?: { id: string; name: string }[];
}

interface BabyProfileFormProps {
  initial?: BabyProfileFormInitial;
  submitLabel: string;
  onSuccess: (babyId: string, warnings: string[]) => void;
}

export function BabyProfileForm({ initial, submitLabel, onSuccess }: BabyProfileFormProps) {
  const initialAge = initial?.ageMonth ?? 15;
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [birthDateError, setBirthDateError] = useState<string | null>(null);
  const [ageMonth, setAgeMonth] = useState<number>(initialAge);
  const [saltLevel, setSaltLevel] = useState<SaltLevel>(
    initial?.saltLevel ?? defaultSaltLevelForAge(initialAge),
  );
  const [saltManuallyChanged, setSaltManuallyChanged] = useState(Boolean(initial?.saltLevel));
  const [selectedAllergens, setSelectedAllergens] = useState<Allergen[]>(initial?.allergens ?? []);
  const [selectedIngredients, setSelectedIngredients] = useState<{ id: string; name: string }[]>(
    initial?.ingredientItems ?? [],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<IngredientOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stage = getAgeStage(ageMonth) ?? 1;
  const stageInfo = getAgeStageInfo(stage);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }
    let cancelled = false;
    fetch(`/api/ingredients?mode=allergy&q=${encodeURIComponent(trimmed)}`)
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((data) => {
        if (!cancelled) {
          setSuggestions(data.results ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  function applyResolvedAgeMonth(nextMonth: number) {
    setAgeMonth(nextMonth);
    if (!saltManuallyChanged) {
      setSaltLevel(defaultSaltLevelForAge(nextMonth));
    }
  }

  function handleBirthDateChange(nextValue: string) {
    setBirthDate(nextValue);
    setError(null);

    const trimmed = nextValue.trim();
    if (!trimmed) {
      setBirthDateError(null);
      return;
    }

    if (!isValidCalendarDateString(trimmed)) {
      setBirthDateError("올바른 생년월일(YYYY-MM-DD)을 입력해 주세요.");
      return;
    }

    const todayStr = kstDateString();
    if (trimmed > todayStr) {
      setBirthDateError("생년월일은 오늘 이전 날짜여야 합니다.");
      return;
    }

    const computedMonths = ageMonthsFromBirthDate(parseKstDate(trimmed));
    if (computedMonths < MIN_AGE_MONTH) {
      setBirthDateError(
        `지원 월령은 ${MIN_AGE_MONTH}개월부터입니다. (입력 생년월일 기준 만 ${computedMonths}개월)`,
      );
      return;
    }
    if (computedMonths > MAX_AGE_MONTH && trimmed !== initial?.birthDate) {
      setBirthDateError(
        `지원 월령은 ${MAX_AGE_MONTH}개월까지입니다. (입력 생년월일 기준 만 ${computedMonths}개월)`,
      );
      return;
    }

    setBirthDateError(null);
    applyResolvedAgeMonth(Math.min(MAX_AGE_MONTH, Math.max(MIN_AGE_MONTH, computedMonths)));
  }

  function handleManualAgeChange(nextMonth: number) {
    setBirthDate("");
    setBirthDateError(null);
    setError(null);
    applyResolvedAgeMonth(nextMonth);
  }

  function toggleAllergen(code: Allergen) {
    setSelectedAllergens((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    );
  }

  function addIngredientChip(item: { id: string; name: string }) {
    if (!selectedIngredients.some((s) => s.id === item.id)) {
      setSelectedIngredients((prev) => [...prev, item]);
    }
    setSearchQuery("");
    setSuggestions([]);
  }

  function removeIngredientChip(id: string) {
    setSelectedIngredients((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (birthDateError) {
      setError(birthDateError);
      return;
    }

    setSubmitting(true);

    try {
      const leftoverCustomTerms = searchQuery.trim() ? [searchQuery.trim()] : [];
      const trimmedBirthDate = birthDate.trim();
      const payload = {
        nickname: nickname.trim() || undefined,
        ...(trimmedBirthDate
          ? { birthDate: trimmedBirthDate, ageMonth }
          : initial?.id
            ? { birthDate: null, ageMonth }
            : { ageMonth }),
        saltLevel,
        allergens: selectedAllergens,
        ingredientIds: selectedIngredients.map((i) => i.id),
        customAllergyTerms: leftoverCustomTerms,
      };

      const url = initial?.id ? `/api/babies/${initial.id}` : "/api/babies";
      const method = initial?.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "프로필 저장에 실패했습니다.");
        return;
      }

      setSearchQuery("");
      onSuccess(data.baby.id, data.warnings ?? []);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasValidBirthDate = Boolean(birthDate.trim()) && !birthDateError;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-3.5 text-sm font-semibold text-[var(--color-danger-text)]"
        >
          {error}
        </div>
      )}

      <Input
        id="baby-nickname"
        label="아기 애칭 / 닉네임 (선택)"
        hint="개인정보 보호를 위해 실명 대신 애칭 입력을 권장합니다."
        type="text"
        maxLength={20}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="예: 튼튼이"
      />

      <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id="baby-birth-date"
            label="아기 생년월일 (선택 시 월령 자동 반영)"
            hint="생년월일을 입력하면 생일마다 월령·단계가 자동 계산됩니다."
            type="date"
            value={birthDate}
            error={birthDateError}
            onChange={(e) => handleBirthDateChange(e.target.value)}
          />

          <Select
            id="baby-age-month"
            label="현재 월령 (12~48개월)"
            hint={
              hasValidBirthDate
                ? "생년월일 기준으로 자동 반영된 월령입니다. 직접 변경하면 수동 월령으로 전환됩니다."
                : "생년월일 미입력 시 현재 월령을 직접 선택할 수 있습니다."
            }
            value={ageMonth}
            onChange={(e) => handleManualAgeChange(Number(e.target.value))}
          >
            {Array.from({ length: 37 }, (_, idx) => 12 + idx).map((m) => (
              <option key={m} value={m}>
                {m}개월
              </option>
            ))}
          </Select>
        </div>

        <div
          role="status"
          aria-live="polite"
          data-testid="auto-stage-preview"
          className="rounded-lg border border-[var(--color-secondary-border)] bg-[var(--color-secondary-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--color-secondary-text)]"
        >
          {hasValidBirthDate ? (
            <>
              생년월일(<strong>{birthDate.trim()}</strong>) 기준 현재 만{" "}
              <strong>{ageMonth}개월</strong> · 자동 지정 단계: <strong>{stageInfo.label}</strong> (
              {stageInfo.texture}) — 아기 생일마다 월령과 유아식 단계가 자동 반영됩니다.
            </>
          ) : (
            <>
              자동 지정 단계: <strong>{stageInfo.label}</strong> ({stageInfo.texture}) — 생년월일을
              함께 입력하면 매달 생일 기준으로 더 정확히 자동 반영됩니다.
            </>
          )}
        </div>
      </div>

      <fieldset>
        <legend className="block text-sm font-semibold text-[var(--color-text)]">
          간(염분) 단계
        </legend>
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
          월령에 맞는 기본값이 제안되며 언제든 변경할 수 있어요.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["NONE", "LOW", "NORMAL"] as const).map((lvl) => {
            const active = saltLevel === lvl;
            return (
              <label
                key={lvl}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[var(--color-border-strong)] bg-white text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                }`}
              >
                <input
                  type="radio"
                  name="saltLevel"
                  value={lvl}
                  checked={active}
                  onChange={() => {
                    setSaltLevel(lvl);
                    setSaltManuallyChanged(true);
                  }}
                  className="sr-only"
                />
                {active && <span aria-hidden="true">✓</span>}
                <span>{SALT_LEVEL_LABELS[lvl]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="block text-sm font-semibold text-[var(--color-text)]">
          주요 알레르기 유발 식품 체크 (선택 — 체크 시 해당 재료 포함 메뉴는 절대 노출되지 않습니다)
        </legend>
        <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
          {ALLERGENS.map((code) => {
            const checked = selectedAllergens.includes(code);
            return (
              <label
                key={code}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium transition-colors ${
                  checked
                    ? "bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]"
                    : "text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAllergen(code)}
                  className="h-4 w-4 shrink-0 accent-[var(--color-danger)]"
                />
                <span>{ALLERGEN_LABELS[code]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <Input
          id="custom-allergy-search"
          label="기타 알레르기·기피 식재료 직접 검색 추가 (선택)"
          hint="식재료 사전 자동완성에서 선택하면 하위 조리 메뉴까지 정확히 제외됩니다."
          type="text"
          value={searchQuery}
          onChange={(e) => {
            const val = e.target.value;
            setSearchQuery(val);
            if (!val.trim()) setSuggestions([]);
          }}
          placeholder="식재료명 입력 (예: 오이, 브로콜리, 계란)"
        />

        {suggestions.length > 0 && (
          <ul className="mt-1.5 max-h-48 overflow-auto rounded-lg border border-[var(--color-border-strong)] bg-white p-1 text-sm shadow-md">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => addIngredientChip({ id: s.id, name: s.name })}
                  className="flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                >
                  <span>{s.name}</span>
                  {s.synonyms.length > 0 && (
                    <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                      ({s.synonyms.slice(0, 2).join(", ")})
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedIngredients.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {selectedIngredients.map((item) => (
              <Chip
                key={item.id}
                tone="danger"
                onRemove={() => removeIngredientChip(item.id)}
                removeLabel={`${item.name} 제거`}
              >
                {item.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" fullWidth size="lg" disabled={submitting}>
        {submitting ? "저장 중..." : submitLabel}
      </Button>
    </form>
  );
}
