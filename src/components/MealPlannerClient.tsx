"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { BabyProfileView } from "@/features/profile";
import { addDays, aggregateNutrition, scheduledCookingDays } from "@/features/meal-plan/engine";
import {
  NUTRIENTS,
  MEAL_STYLES,
  type MealStyle,
  preferencesSchema,
  type PlannerData,
  type PlanPreferences,
  type PlanView,
  type RecipeSnapshot,
} from "@/features/meal-plan/types";
import { scaleIngredientAmount } from "@/features/serving";
import { currentAgeMonth, kstDateString } from "@/lib/age";
import { NUTRITION_REFERENCE_SOURCE, nutritionReference } from "@/features/meal-plan/references";

const field =
  "min-h-11 w-full rounded-md border border-[var(--color-border-strong)] bg-white px-3 py-2 text-base";
const panel = "rounded-xl border border-[var(--color-border)] bg-white p-5";
const mealLabels = { BREAKFAST: "아침", LUNCH: "점심", DINNER: "저녁", SNACK: "간식" };
const groupLabels: Record<string, string> = {
  GRAIN: "곡류",
  MEAT: "고기",
  SEAFOOD: "생선·해산물",
  EGG: "달걀",
  LEGUME_TOFU: "콩·두부",
  VEGETABLE: "채소",
  FRUIT: "과일",
  DAIRY: "유제품",
  NUT_SEED: "견과·씨앗",
};
const priorities: { value: PlanPreferences["priorities"][number]; label: string }[] = [
  { value: "PANTRY", label: "재료 소진" },
  { value: "EASY", label: "조리 간편" },
  { value: "FAVORITE", label: "좋아하는 메뉴" },
  { value: "VARIETY", label: "다양한 메뉴" },
];
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
function Choice({
  active,
  children,
  onClick,
  disabled = false,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-md border px-3 py-2 text-sm disabled:opacity-50 ${active ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" : "border-[var(--color-border)] bg-white"}`}
    >
      {children}
    </button>
  );
}

export function MealPlannerClient({
  baby,
  initialData,
  initialIngredients,
  initialRecipeId,
}: {
  baby: BabyProfileView;
  initialData: PlannerData;
  initialIngredients: string[];
  initialRecipeId?: string;
}) {
  const today = kstDateString(new Date());
  const [data, setData] = useState(initialData);
  const [planId, setPlanId] = useState(initialData.plans[0]?.id ?? "");
  const [tab, setTab] = useState<"PLAN" | "STOCK">("PLAN");
  const [wizard, setWizard] = useState(initialIngredients.length > 0 || !initialData.plans.length);
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<PlanPreferences>(() => ({
    ...preferencesSchema.parse({
      ...(initialData.savedPreferences ?? initialData.plans[0]?.preferences ?? {}),
      startDate: today,
    }),
    ...(initialIngredients.length
      ? {
          selectedIngredientIds: initialIngredients,
          priorities: ["PANTRY", "EASY"] as PlanPreferences["priorities"],
        }
      : {}),
  }));
  const [selectedDate, setSelectedDate] = useState(
    initialData.plans[0]?.entries.some((e) => e.date === today)
      ? today
      : (initialData.plans[0]?.startDate ?? today),
  );
  const [allDays, setAllDays] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingRecipe, setPendingRecipe] = useState(initialRecipeId ?? "");
  const [search, setSearch] = useState("");
  const [ingredientLimit, setIngredientLimit] = useState(40);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stockFilter, setStockFilter] = useState("ALL");
  const stockKey = useRef<string | null>(null);
  const plan = data.plans.find((p) => p.id === planId);
  const usedIngredients = new Set(
    plan?.entries
      .filter((e) => e.kind === "HOME" && e.recipeId)
      .flatMap((e) => (e.snapshot as RecipeSnapshot).ingredientIds ?? []) ?? [],
  );
  const unusedSelected =
    plan?.preferences.selectedIngredientIds.filter((id) => !usedIngredients.has(id)) ?? [];

  async function run(url: string, method: string, body: Record<string, unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, babyId: baby.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message ?? "저장하지 못했습니다.");
      const refreshed = await fetch(`/api/meal-plans?babyId=${baby.id}`, { cache: "no-store" });
      if (!refreshed.ok) throw new Error("변경 후 목록을 불러오지 못했습니다. 새로고침해 주세요.");
      const next: PlannerData = await refreshed.json();
      setData(next);
      if (!next.plans.some((p) => p.id === planId)) setPlanId(next.plans[0]?.id ?? "");
      if (method === "POST" && url === "/api/meal-plans") {
        setPlanId(result.id);
        setSelectedDate(prefs.startDate);
        setWizard(false);
      }
      setNotice(success);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  function act(action: string, extra: Record<string, unknown> = {}) {
    if (!plan) return Promise.resolve();
    return run(
      `/api/meal-plans/${plan.id}`,
      "PATCH",
      { action, revision: plan.revision, ...extra },
      "식단에 반영했습니다.",
    );
  }
  function update<K extends keyof PlanPreferences>(key: K, value: PlanPreferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }
  function recipeSelect(name: string, defaultValue = "", required = true) {
    return (
      <select
        name={name}
        aria-label="담을 레시피"
        className={field}
        defaultValue={defaultValue}
        required={required}
      >
        <option value="">레시피 선택</option>
        {data.recipes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.verified ? "" : " · 출처 미확인"}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">일주일 식단</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {baby.displayName} · {baby.currentAgeMonth}개월 · 알레르기·간 단계 적용 중
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setWizard(true);
            setStep(0);
            update("startDate", today);
          }}
          disabled={busy}
        >
          새 식단 짜기
        </Button>
      </div>
      {baby.allergies.length > 0 && (
        <p className="text-sm">제외 중: {baby.allergies.map((a) => a.label).join(", ")}</p>
      )}
      <div className="flex gap-2" role="group" aria-label="식단과 음식 재고">
        <Choice active={tab === "PLAN"} onClick={() => setTab("PLAN")}>
          이번 주
        </Choice>
        <Choice
          active={tab === "STOCK"}
          onClick={() => {
            setTab("STOCK");
            setWizard(false);
          }}
        >
          만든 음식
        </Choice>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4"
        >
          {error}{" "}
          <Button variant="ghost" onClick={() => window.location.reload()}>
            새로고침
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm text-[var(--color-primary)]">
          {notice}
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm">
          변경 내용을 저장하고 있어요…
        </p>
      )}

      {wizard && tab === "PLAN" && (
        <section className={panel} aria-label="식단 조건 문답">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {["먹을 일정", "사용할 재료", "준비 방식"][step]}
            </h2>
            <span className="text-sm text-[var(--color-text-secondary)]">{step + 1} / 3</span>
          </div>
          <div className="mt-5 space-y-6">
            {step === 0 && (
              <>
                <label className="block space-y-2">
                  <span>시작일</span>
                  <input
                    className={field}
                    type="date"
                    value={prefs.startDate}
                    min={today}
                    max={addDays(today, 90)}
                    onChange={(e) => update("startDate", e.target.value)}
                  />
                </label>
                <fieldset>
                  <legend className="mb-3 font-medium">어떤 끼니를 준비할까요?</legend>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { value: "ALL", label: "매일 세 끼" },
                        { value: "WORKDAY", label: "평일 아침·저녁, 주말 세 끼" },
                        { value: "CUSTOM", label: "직접 선택" },
                      ] as const
                    ).map((o) => (
                      <Choice
                        key={o.value}
                        active={prefs.schedule === o.value}
                        onClick={() => {
                          update("schedule", o.value);
                          if (o.value !== "CUSTOM")
                            update("meals", ["BREAKFAST", "LUNCH", "DINNER"]);
                        }}
                      >
                        {o.label}
                      </Choice>
                    ))}
                  </div>
                  {prefs.schedule === "CUSTOM" && (
                    <div className="mt-3 flex gap-2">
                      {(["BREAKFAST", "LUNCH", "DINNER"] as const).map((t) => (
                        <Choice
                          key={t}
                          active={prefs.meals.includes(t)}
                          onClick={() =>
                            update(
                              "meals",
                              prefs.meals.includes(t)
                                ? prefs.meals.filter((m) => m !== t)
                                : [...prefs.meals, t],
                            )
                          }
                        >
                          {mealLabels[t]}
                        </Choice>
                      ))}
                    </div>
                  )}
                </fieldset>
                <fieldset className="space-y-3">
                  <legend className="font-medium">평소 한 끼를 어떻게 차리나요?</legend>
                  {(["BREAKFAST", "LUNCH", "DINNER"] as const).map((t) => (
                    <label key={t} className="flex items-center justify-between gap-3 text-sm">
                      <span>{mealLabels[t]}</span>
                      <select
                        className={field}
                        aria-label={`${mealLabels[t]} 식단 유형`}
                        value={prefs.mealStyles[t]}
                        onChange={(e) =>
                          update("mealStyles", {
                            ...prefs.mealStyles,
                            [t]: e.target.value as MealStyle,
                          })
                        }
                      >
                        {Object.entries(MEAL_STYLES).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  {Object.values(prefs.mealStyles).includes("RICE_SIDES") && (
                    <div className="space-y-3 border-l-2 border-[var(--color-border)] pl-3">
                      <label className="block text-sm">
                        밥을 제외한 반찬 수{" "}
                        <select
                          aria-label="반찬 수"
                          className={field}
                          value={prefs.sideCount}
                          onChange={(e) => update("sideCount", Number(e.target.value))}
                        >
                          <option value={3}>3개</option>
                          <option value={4}>4개</option>
                        </select>
                      </label>
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={prefs.requireMeat}
                          onChange={(e) => update("requireMeat", e.target.checked)}
                        />
                        고기 반찬 1개 이상 포함
                      </label>
                      <label className="block text-sm">
                        반찬별 먹을 양 (레시피 1회분 기준)
                        <input
                          className={field}
                          aria-label="반찬별 먹을 회분"
                          type="number"
                          min="0.1"
                          max="1"
                          step="0.1"
                          value={prefs.sidePortion}
                          onChange={(e) => update("sidePortion", Number(e.target.value))}
                        />
                      </label>
                      <p className="text-xs">
                        0.5는 해당 반찬 레시피 1회분의 절반입니다. 아기에게 맞게 조절하세요. 밥은
                        기본 1회분이며 메뉴별 변경도 가능해요.
                      </p>
                    </div>
                  )}
                  <details className="disclosure">
                    <summary>유형별 메뉴가 얼마나 있나요?</summary>
                    <div className="disclosure-body space-y-1 text-sm">
                      {(["SOUP", "ONE_BOWL", "SIDE", "STAPLE"] as const).map((type) => (
                        <p key={type}>
                          {
                            { SOUP: "스프류", ONE_BOWL: "한그릇", SIDE: "반찬", STAPLE: "밥·주식" }[
                              type
                            ]
                          }
                          : {data.recipes.filter((r) => r.verified && r.dishType === type).length}개
                        </p>
                      ))}
                      <p>
                        현재 아기의 월령·간·알레르기와 출처 확인을 적용한 개수입니다.
                        조리시간·도구·재료 조건을 추가하면 후보가 줄어들 수 있어요. 맞는 후보가
                        없으면 다른 유형으로 자동 대체하지 않습니다.
                      </p>
                    </div>
                  </details>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    다음 식단에도 이 설정을 사용해요. 스프만 선택해도 하루 영양 충족을 보장하지
                    않으니 영양 체크와 다른 끼니를 함께 확인하세요.
                  </p>
                </fieldset>
                <fieldset>
                  <legend className="mb-3 font-medium">간식도 넣을까요?</legend>
                  <div className="flex gap-2">
                    {[0, 1, 2].map((n) => (
                      <Choice
                        key={n}
                        active={prefs.snackCount === n}
                        onClick={() => update("snackCount", n)}
                      >
                        {n ? `하루 ${n}번` : "없음"}
                      </Choice>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    횟수는 준비할 일정에 맞춰 선택해 주세요.
                  </p>
                </fieldset>
              </>
            )}
            {step === 1 && (
              <>
                <div>
                  <h3 className="font-medium">먼저 쓸 재료가 있나요?</h3>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    수량을 몰라도 괜찮아요. 선택한 재료를 최대한 활용해요.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => update("selectedIngredientIds", data.pantryIds)}
                  >
                    냉장고에서 가져오기
                  </Button>
                  <Button variant="ghost" onClick={() => update("selectedIngredientIds", [])}>
                    선택 지우기 · 없어요
                  </Button>
                </div>
                <label className="block">
                  <span className="sr-only">재료 검색</span>
                  <input
                    className={field}
                    placeholder="재료 이름 검색"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setIngredientLimit(40);
                    }}
                  />
                </label>
                <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
                  {data.ingredients
                    .filter(
                      (i) => i.name.includes(search) || prefs.selectedIngredientIds.includes(i.id),
                    )
                    .slice(0, ingredientLimit)
                    .map((i) => (
                      <Choice
                        key={i.id}
                        active={prefs.selectedIngredientIds.includes(i.id)}
                        onClick={() =>
                          update(
                            "selectedIngredientIds",
                            prefs.selectedIngredientIds.includes(i.id)
                              ? prefs.selectedIngredientIds.filter((id) => id !== i.id)
                              : [...prefs.selectedIngredientIds, i.id],
                          )
                        }
                      >
                        {i.name}
                      </Choice>
                    ))}
                </div>
                {data.ingredients.filter((i) => i.name.includes(search)).length >
                  ingredientLimit && (
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => setIngredientLimit((n) => n + 40)}
                  >
                    재료 더보기 ({ingredientLimit}/
                    {data.ingredients.filter((i) => i.name.includes(search)).length})
                  </Button>
                )}
                <p className="text-xs text-[var(--color-text-secondary)]">
                  전체 {data.ingredients.length}개 재료 · 선택 상태는 유지돼요.
                </p>
                <p className="text-sm">
                  선택 {prefs.selectedIngredientIds.length}개:{" "}
                  {data.ingredients
                    .filter((i) => prefs.selectedIngredientIds.includes(i.id))
                    .map((i) => i.name)
                    .join(", ") || "선택한 재료 없음"}
                </p>
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.allowShopping}
                    onChange={(e) => update("allowShopping", e.target.checked)}
                  />
                  필요하면 추가 재료 장보기 허용
                </label>
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.useStock}
                    onChange={(e) => update("useStock", e.target.checked)}
                  />
                  사용 가능한 만든 음식 재고 먼저 활용
                </label>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  사용 가능한 음식 {data.stock.filter((s) => s.usable && s.available > 0).length}종.
                  기한·재료 확인이 필요한 음식은 자동 배치하지 않아요.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <fieldset>
                  <legend className="mb-3 font-medium">음식은 얼마나 자주 준비하나요?</legend>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3].map((n) => (
                      <Choice
                        key={n}
                        active={
                          prefs.cookingInterval === n && !(n === 1 && prefs.cookingMode === "BATCH")
                        }
                        onClick={() => {
                          update("cookingInterval", n);
                          update("cookingMode", n === 1 ? "DAILY" : "BATCH");
                          if (!prefs.cookingAnchor) update("cookingAnchor", prefs.startDate);
                        }}
                      >
                        {n === 1 ? "매일" : `${n}일마다`}
                      </Choice>
                    ))}
                    <Choice
                      active={prefs.cookingMode === "BATCH" && prefs.cookingInterval === 1}
                      onClick={() => {
                        update("cookingMode", "BATCH");
                        update("cookingInterval", 1);
                      }}
                    >
                      직접 날짜 선택
                    </Choice>
                  </div>
                </fieldset>
                {prefs.cookingInterval > 1 && (
                  <div className="space-y-2">
                    <label className="block text-sm">
                      반복 기준일
                      <input
                        aria-label="조리 반복 기준일"
                        className={field}
                        type="date"
                        max={prefs.startDate}
                        value={prefs.cookingAnchor ?? prefs.startDate}
                        onChange={(e) => update("cookingAnchor", e.target.value)}
                      />
                    </label>
                    <p className="text-sm">
                      정기 조리일: {scheduledCookingDays(prefs).map(dateLabel).join(", ")}. 계획 첫
                      구간에 사용할 재고가 없으면 시작일에 준비할 음식도 안내해요.
                    </p>
                  </div>
                )}
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={prefs.repeatMeals}
                    onChange={(e) => update("repeatMeals", e.target.checked)}
                  />
                  같은 메뉴를 조리 구간 안에서 나눠 먹어도 좋아요
                </label>
                {prefs.cookingMode === "BATCH" && prefs.cookingInterval === 1 && (
                  <fieldset>
                    <legend className="mb-2 text-sm">조리할 날 (첫날 포함, 변경 가능)</legend>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: 7 }, (_, n) => (
                        <Choice
                          key={n}
                          active={n === 0 || prefs.cookingDays.includes(n)}
                          disabled={n === 0}
                          onClick={() =>
                            update(
                              "cookingDays",
                              prefs.cookingDays.includes(n)
                                ? prefs.cookingDays.filter((d) => d !== n)
                                : [...prefs.cookingDays, n],
                            )
                          }
                        >
                          {dateLabel(addDays(prefs.startDate, n))}
                        </Choice>
                      ))}
                    </div>
                    <p className="mt-2 text-sm">
                      모아 만든 음식은 실제 보관 장소와 사용 기한을 확인해 저장해 주세요.
                    </p>
                  </fieldset>
                )}
                <fieldset>
                  <legend className="mb-3 font-medium">이번 주에 더 중요한 것은? (최대 2개)</legend>
                  <div className="flex flex-wrap gap-2">
                    {priorities.map((p) => (
                      <Choice
                        key={p.value}
                        active={prefs.priorities.includes(p.value)}
                        onClick={() =>
                          update(
                            "priorities",
                            prefs.priorities.includes(p.value)
                              ? prefs.priorities.filter((v) => v !== p.value)
                              : prefs.priorities.length < 2
                                ? [...prefs.priorities, p.value]
                                : [prefs.priorities[1], p.value],
                          )
                        }
                      >
                        {p.label}
                      </Choice>
                    ))}
                  </div>
                </fieldset>
                <details>
                  <summary className="cursor-pointer py-3 font-medium">더 설정하기</summary>
                  <div className="mt-3 space-y-4">
                    <fieldset>
                      <legend className="mb-2 text-sm">
                        사용할 조리도구 (선택하지 않으면 제한 없음)
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {["냄비", "프라이팬", "전자레인지", "에어프라이어", "오븐", "찜기"].map(
                          (tool) => (
                            <Choice
                              key={tool}
                              active={prefs.tools.includes(tool)}
                              onClick={() =>
                                update(
                                  "tools",
                                  prefs.tools.includes(tool)
                                    ? prefs.tools.filter((t) => t !== tool)
                                    : [...prefs.tools, tool],
                                )
                              }
                            >
                              {tool}
                            </Choice>
                          ),
                        )}
                      </div>
                    </fieldset>
                    <label className="block space-y-2">
                      <span>레시피 조리시간 상한</span>
                      <select
                        className={field}
                        value={prefs.maxCookMinutes}
                        onChange={(e) => update("maxCookMinutes", Number(e.target.value))}
                      >
                        {[10, 15, 20, 30, 60, 120].map((v) => (
                          <option key={v} value={v}>
                            {v}분 이내
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span>이번 주 피할 재료 (알레르기와 별도)</span>
                      <select
                        multiple
                        className={`${field} min-h-32`}
                        value={prefs.avoidedIngredientIds}
                        onChange={(e) =>
                          update(
                            "avoidedIngredientIds",
                            Array.from(e.target.selectedOptions).map((o) => o.value),
                          )
                        }
                      >
                        {data.ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </details>
              </>
            )}
            <div className="flex flex-wrap justify-between gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => (step ? setStep(step - 1) : setWizard(false))}
              >
                {step ? "이전" : "닫기"}
              </Button>
              {step < 2 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!prefs.startDate}>
                  다음
                </Button>
              ) : (
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(
                      "/api/meal-plans",
                      "POST",
                      { preferences: prefs },
                      "7일 식단 초안을 만들었습니다. 빈 메뉴와 영양 정보를 확인해 주세요.",
                    )
                  }
                >
                  식단 초안 만들기
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "PLAN" && plan && (
        <>
          <section className="space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              선택한 재료 {plan.preferences.selectedIngredientIds.length}종 중{" "}
              {plan.preferences.selectedIngredientIds.length - unusedSelected.length}종 활용 · 조리
              예정 {new Set(plan.tasks.filter((t) => !t.completed).map((t) => t.date)).size}일
            </p>
            {unusedSelected.length > 0 && (
              <p className="rounded-md bg-[var(--color-warning-soft)] p-3 text-sm">
                현재 후보에서 활용하지 못한 재료:{" "}
                {data.ingredients
                  .filter((i) => unusedSelected.includes(i.id))
                  .map((i) => i.name)
                  .join(", ")}
                . 레시피를 직접 담거나 조건을 조정해 주세요.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="min-w-0 flex-1">
                <span className="sr-only">저장한 식단</span>
                <select
                  className={field}
                  value={planId}
                  onChange={(e) => {
                    setPlanId(e.target.value);
                    const p = data.plans.find((p) => p.id === e.target.value);
                    if (p) setSelectedDate(p.startDate);
                  }}
                >
                  {data.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {dateLabel(p.startDate)} ~ {dateLabel(addDays(p.startDate, 6))} ·{" "}
                      {p.status === "CONFIRMED" ? "확정" : "초안"}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="ghost"
                onClick={() => {
                  setPrefs({ ...plan.preferences, startDate: today });
                  setStep(0);
                  setWizard(true);
                }}
              >
                조건으로 새로 만들기
              </Button>
            </div>
            {!data.recipes.some((r) => r.verified) && (
              <p role="status" className="rounded-md bg-[var(--color-warning-soft)] p-4 text-sm">
                출처 확인을 마친 자동 추천 후보가 아직 없어요. 레시피를 직접 담을 수 있으며, 출처
                미확인 여부를 표시합니다.
              </p>
            )}
            {plan.entries.some((e) => e.needsAttention && e.kind === "HOME") && (
              <p role="status" className="rounded-md bg-[var(--color-warning-soft)] p-4 text-sm">
                빈 메뉴 또는 변경된 아기 조건·레시피가 있어요. 해당 메뉴를 확인하고 식단을 확정해
                주세요.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => act(plan.status === "CONFIRMED" ? "EDIT" : "CONFIRM")}
              >
                {plan.status === "CONFIRMED" ? "식단 수정" : "식단 확정"}
              </Button>
              {plan.status === "DRAFT" && (
                <Button variant="outline" disabled={busy} onClick={() => act("REGENERATE")}>
                  유지한 메뉴 빼고 다시 추천
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("이 식단을 보관할까요? 예약만 해제되고 만든 음식은 남아요."))
                    act("ARCHIVE");
                }}
              >
                식단 보관
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="식단 날짜">
              {Array.from({ length: 7 }, (_, n) => addDays(plan.startDate, n)).map((d) => (
                <button
                  key={d}
                  className={`min-h-14 rounded-md border px-1 text-xs sm:text-sm ${selectedDate === d && !allDays ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] font-semibold" : "border-[var(--color-border)]"}`}
                  aria-pressed={selectedDate === d && !allDays}
                  onClick={() => {
                    setSelectedDate(d);
                    setAllDays(false);
                  }}
                >
                  {dateLabel(d)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="min-h-11 text-sm underline underline-offset-4"
              onClick={() => setAllDays(!allDays)}
            >
              {allDays ? "하루씩 보기" : "한 주 모아보기"}
            </button>
            {(allDays
              ? Array.from({ length: 7 }, (_, n) => addDays(plan.startDate, n))
              : [selectedDate]
            ).map((d) => (
              <div key={d} className="space-y-3">
                <h2 className="text-lg font-semibold">
                  {dateLabel(d)}
                  {d === today ? " · 오늘" : ""}
                </h2>
                {["BREAKFAST", "LUNCH", "DINNER", "SNACK"]
                  .flatMap((t) =>
                    [0, 1].map((slot) => ({
                      t,
                      slot,
                      group: plan.entries.filter(
                        (e) => e.date === d && e.mealTime === t && e.slotIndex === slot,
                      ),
                    })),
                  )
                  .filter((m) => m.group.length)
                  .map(({ t, slot, group }) => (
                    <details
                      key={`${t}:${slot}`}
                      open={group.length === 1}
                      className="rounded-md border border-[var(--color-border)] bg-white"
                    >
                      <summary className="flex min-h-14 cursor-pointer flex-wrap items-center justify-between gap-2 p-4 font-semibold">
                        <span>
                          {mealLabels[t as keyof typeof mealLabels]}
                          {t === "SNACK" ? ` ${slot + 1}` : ""} ·{" "}
                          {group.length > 1 ? `밥 + 반찬 ${group.length - 1}` : group[0].name}
                        </span>
                        <span className="text-xs font-normal text-[var(--color-text-secondary)]">
                          {group.filter((e) => e.served).length}/{group.length} 제공 · 펼쳐보기
                        </span>
                      </summary>
                      {plan.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            act("MEAL_REGENERATE", { date: d, mealTime: t, slotIndex: slot })
                          }
                        >
                          이 끼니 전체 변경 (유지 메뉴 제외)
                        </Button>
                      )}
                      {plan.status === "CONFIRMED" &&
                        d === today &&
                        group.some((e) => e.kind === "HOME" && !e.served) && (
                          <details className="m-4 border-b border-[var(--color-border)]">
                            <summary className="min-h-11 cursor-pointer py-2 font-medium">
                              한 끼 먹은 기록
                            </summary>
                            <form
                              className="space-y-3 pb-4"
                              onSubmit={(ev) => {
                                ev.preventDefault();
                                const f = new FormData(ev.currentTarget);
                                void act("SERVE_MEAL", {
                                  mealTime: t,
                                  slotIndex: slot,
                                  amounts: group
                                    .filter((e) => e.kind === "HOME" && !e.served)
                                    .map((e) => ({
                                      entryId: e.id,
                                      rating: f.get(`rating-${e.id}`),
                                      amountEaten: f.get(`amount-${e.id}`),
                                    })),
                                });
                              }}
                            >
                              {group
                                .filter((e) => e.kind === "HOME" && !e.served)
                                .map((e) => (
                                  <div key={e.id} className="space-y-2">
                                    <p className="text-sm">
                                      {e.name} · 제공 {e.servings}회분
                                    </p>
                                    <div className="flex gap-2">
                                      <select
                                        className={field}
                                        aria-label={`${e.name} 반응`}
                                        name={`rating-${e.id}`}
                                      >
                                        <option value="OK">보통</option>
                                        <option value="GOOD">잘 먹음</option>
                                        <option value="REFUSED">안 먹음</option>
                                      </select>
                                      <select
                                        className={field}
                                        aria-label={`${e.name} 먹은 양`}
                                        name={`amount-${e.id}`}
                                      >
                                        <option value="ALL">다 먹음</option>
                                        <option value="HALF">반</option>
                                        <option value="LITTLE">조금</option>
                                      </select>
                                    </div>
                                  </div>
                                ))}
                              <Button type="submit" disabled={busy}>
                                한 끼 제공 · 재고 차감 · 기록
                              </Button>
                              <p className="text-xs">
                                모든 음식이 조리·재고 예약되어 있어야 저장돼요. 남긴 양은 따로
                                기록하며 꺼내 제공한 양을 차감합니다.
                              </p>
                            </form>
                          </details>
                        )}
                      {group.map((e) => (
                        <div key={e.id} className={panel}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                                {mealLabels[e.mealTime]}
                                {e.mealTime === "SNACK" ? ` ${e.slotIndex + 1}` : ""}{" "}
                                {e.locked ? "· 유지" : ""}
                              </p>
                              <p className="mt-1 font-semibold">
                                {e.kind === "HOME"
                                  ? e.name
                                  : e.kind === "EXTERNAL"
                                    ? "외부 식사"
                                    : "계획 제외"}
                                {e.served ? " · 제공 완료" : ""}
                              </p>
                              {e.kind === "HOME" && (
                                <p className="mt-1 text-sm">
                                  먹을 양 {e.servings}회분 · 재고 예약 {e.reserved}회분
                                </p>
                              )}
                              {e.recipeId && !(e.snapshot as RecipeSnapshot).verified && (
                                <p className="mt-1 text-sm text-[var(--color-warning-text)]">
                                  레시피 출처 미확인
                                </p>
                              )}
                              {e.needsAttention && (
                                <p className="mt-1 text-sm text-[var(--color-danger)]">
                                  메뉴 확인 필요
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {e.recipeId && (
                                <Link
                                  href={`/recipes/${e.recipeId}`}
                                  className="inline-flex min-h-11 items-center px-3 text-sm underline"
                                >
                                  레시피
                                </Link>
                              )}
                              {!e.served && plan.status === "DRAFT" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() =>
                                      act("ENTRY", { entryId: e.id, locked: !e.locked })
                                    }
                                  >
                                    {e.locked ? "유지 해제" : "유지"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditing(editing === e.id ? null : e.id)}
                                  >
                                    메뉴·일정 바꾸기
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {editing === e.id && plan.status === "DRAFT" && (
                            <form
                              className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4"
                              onSubmit={async (ev) => {
                                ev.preventDefault();
                                const f = new FormData(ev.currentTarget);
                                const result = await act("ENTRY", {
                                  entryId: e.id,
                                  ...(f.get("recipeId") ? { recipeId: f.get("recipeId") } : {}),
                                  servings: Number(f.get("servings")),
                                  date: f.get("date"),
                                  mealTime: f.get("mealTime"),
                                  kind: f.get("kind"),
                                });
                                if (result) setEditing(null);
                              }}
                            >
                              {recipeSelect("recipeId", e.recipeId ?? "", false)}
                              <p className="text-sm text-[var(--color-text-secondary)]">
                                직접 담은 메뉴는 현재 아기 조건으로 확인합니다. 출처 미확인 메뉴는
                                영양·조리법을 함께 확인해 주세요.
                              </p>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1">
                                  <span className="text-sm">먹을 예정 회분</span>
                                  <input
                                    className={field}
                                    name="servings"
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    max="5"
                                    defaultValue={e.servings}
                                    required
                                  />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-sm">날짜</span>
                                  <input
                                    className={field}
                                    name="date"
                                    type="date"
                                    min={plan.startDate > today ? plan.startDate : today}
                                    max={addDays(plan.startDate, 6)}
                                    defaultValue={e.date}
                                    required
                                  />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-sm">끼니</span>
                                  <select
                                    className={field}
                                    name="mealTime"
                                    defaultValue={e.mealTime}
                                  >
                                    {Object.entries(mealLabels).map(([k, v]) => (
                                      <option key={k} value={k}>
                                        {v}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="space-y-1">
                                  <span className="text-sm">일정</span>
                                  <select className={field} name="kind" defaultValue={e.kind}>
                                    <option value="HOME">집에서 먹기</option>
                                    <option value="EXTERNAL">어린이집·외식</option>
                                    <option value="SKIPPED">계획 제외</option>
                                  </select>
                                </label>
                              </div>
                              <Button type="submit" disabled={busy}>
                                변경 저장
                              </Button>
                            </form>
                          )}
                          {plan.status === "CONFIRMED" &&
                            e.kind === "HOME" &&
                            !e.served &&
                            e.date === today && (
                              <details className="mt-3">
                                <summary className="cursor-pointer py-3 text-sm font-medium">
                                  먹은 기록 · 재고에서 꺼내기
                                </summary>
                                <form
                                  className="mt-2 flex flex-wrap items-end gap-3"
                                  onSubmit={(ev) => {
                                    ev.preventDefault();
                                    const f = new FormData(ev.currentTarget);
                                    act("SERVE", {
                                      entryId: e.id,
                                      rating: f.get("rating"),
                                      ...(f.get("amountEaten")
                                        ? { amountEaten: f.get("amountEaten") }
                                        : {}),
                                    });
                                  }}
                                >
                                  <label>
                                    <span className="mb-1 block text-sm">반응</span>
                                    <select name="rating" className={field} defaultValue="OK">
                                      <option value="GOOD">잘 먹었어요</option>
                                      <option value="OK">보통이에요</option>
                                      <option value="REFUSED">안 먹었어요</option>
                                    </select>
                                  </label>
                                  <label>
                                    <span className="mb-1 block text-sm">먹은 양</span>
                                    <select name="amountEaten" className={field}>
                                      <option value="">선택 안 함</option>
                                      <option value="ALL">다 먹음</option>
                                      <option value="HALF">반</option>
                                      <option value="LITTLE">조금</option>
                                    </select>
                                  </label>
                                  <Button type="submit" disabled={busy}>
                                    제공한 {e.servings}회분 차감 · 기록
                                  </Button>
                                  <p className="w-full text-sm text-[var(--color-text-secondary)]">
                                    남긴 양과 관계없이 꺼내 제공한 양을 차감해요.
                                  </p>
                                </form>
                              </details>
                            )}
                        </div>
                      ))}
                    </details>
                  ))}
              </div>
            ))}
            {plan.status === "DRAFT" && (
              <details open={!!pendingRecipe} className={panel}>
                <summary className="cursor-pointer py-1 font-medium">
                  메뉴 추가 · 밥·반찬 함께 담기
                </summary>
                <form
                  className="mt-4 space-y-3"
                  onSubmit={async (ev) => {
                    ev.preventDefault();
                    const f = new FormData(ev.currentTarget);
                    const result = await act("ADD", {
                      recipeId: f.get("recipeId"),
                      date: f.get("date"),
                      mealTime: f.get("mealTime"),
                      slotIndex: Number(f.get("slotIndex")),
                      servings: Number(f.get("servings")),
                    });
                    if (result) setPendingRecipe("");
                  }}
                >
                  {recipeSelect("recipeId", pendingRecipe)}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-sm">날짜</span>
                      <input
                        type="date"
                        className={field}
                        name="date"
                        defaultValue={selectedDate}
                        min={plan.startDate > today ? plan.startDate : today}
                        max={addDays(plan.startDate, 6)}
                        required
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm">끼니</span>
                      <select name="mealTime" className={field} defaultValue="DINNER">
                        {Object.entries(mealLabels).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm">간식 순서 (간식일 때)</span>
                      <select name="slotIndex" className={field}>
                        <option value="0">첫 번째</option>
                        <option value="1">두 번째</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm">먹을 예정 회분</span>
                      <input
                        name="servings"
                        type="number"
                        className={field}
                        min="0.1"
                        step="0.1"
                        max="5"
                        defaultValue="1"
                        required
                      />
                    </label>
                  </div>
                  <Button type="submit" disabled={busy}>
                    이 끼니에 추가
                  </Button>
                </form>
              </details>
            )}
          </section>
          <NutritionPanel plan={plan} selectedDate={selectedDate} baby={baby} />
          {plan.status === "DRAFT" && data.stock.length > 0 && (
            <details className={panel}>
              <summary className="cursor-pointer py-1 font-semibold">
                만든 음식을 식단에 직접 담기
              </summary>
              <form
                className="mt-4 space-y-3"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  const f = new FormData(ev.currentTarget);
                  act("STOCK", {
                    batchId: f.get("batchId"),
                    date: f.get("date"),
                    mealTime: f.get("mealTime"),
                    servings: Number(f.get("servings")),
                    confirmedIngredients: true,
                  });
                }}
              >
                <label className="block space-y-1">
                  <span>만든 음식</span>
                  <select className={field} name="batchId" required>
                    {data.stock.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · 남은 {s.remaining}회분 · 기한 {s.expiresDate ?? "확인 필요"}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span>날짜</span>
                    <input
                      className={field}
                      name="date"
                      type="date"
                      min={plan.startDate > today ? plan.startDate : today}
                      max={addDays(plan.startDate, 6)}
                      defaultValue={selectedDate}
                      required
                    />
                  </label>
                  <label className="space-y-1">
                    <span>끼니</span>
                    <select className={field} name="mealTime" defaultValue="DINNER">
                      {Object.entries(mealLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span>먹을 회분</span>
                    <input
                      className={field}
                      name="servings"
                      type="number"
                      min="0.1"
                      step="0.1"
                      max="5"
                      defaultValue="1"
                      required
                    />
                  </label>
                </div>
                <label className="flex min-h-11 items-start gap-2 py-2">
                  <input type="checkbox" required className="mt-1" />
                  <span className="text-sm">
                    음식의 실제 재료·알레르기와 보관 상태·사용 기한을 직접 확인했습니다.
                  </span>
                </label>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  레시피가 연결되지 않은 음식은 영양·알레르기 적합성을 계산할 수 없어요. 직접 담은
                  음식은 재추천에서 유지합니다.
                </p>
                <Button type="submit" disabled={busy}>
                  재고 음식으로 담기
                </Button>
              </form>
            </details>
          )}
          <section className={panel}>
            <h2 className="text-lg font-semibold">준비할 음식</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              회분은 레시피의 기준 분량이에요. 만들 양과 먹을 양을 따로 관리합니다.
            </p>
            <div className="mt-3 space-y-2">
              {[...new Set(plan.tasks.filter((t) => !t.completed).map((t) => t.date))].map((d) => {
                const tasks = plan.tasks.filter((t) => t.date === d && !t.completed);
                return (
                  <p key={d} className="text-sm">
                    {dateLabel(d)} · {new Set(tasks.map((t) => t.recipeId)).size}가지 · 합계{" "}
                    {Math.round(tasks.reduce((sum, t) => sum + t.servings, 0) * 10) / 10}회분 · 순차
                    조리 약{" "}
                    {tasks.reduce(
                      (sum, t) =>
                        sum + (data.recipes.find((r) => r.id === t.recipeId)?.cookMinutes ?? 0),
                      0,
                    )}
                    분
                  </p>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              조리 주기가 보관 가능 기간은 아닙니다. 완료 시 실제 보관 장소와 사용 기한을 확인해
              주세요. 종류가 많으면 메뉴 반복을 허용해 새 식단을 구성할 수 있어요.
            </p>
            {!plan.tasks.length && <p className="mt-4 text-sm">추가로 조리할 음식이 없어요.</p>}
            <div className="mt-4 divide-y divide-[var(--color-border)]">
              {[...new Set(plan.tasks.map((t) => t.date))].map((cookDay) => (
                <details key={cookDay} className="disclosure">
                  <summary>
                    {dateLabel(cookDay)} ·{" "}
                    {
                      new Set(plan.tasks.filter((t) => t.date === cookDay).map((t) => t.recipeId))
                        .size
                    }
                    가지 준비
                  </summary>
                  <div className="disclosure-body">
                    {plan.tasks
                      .filter((t) => t.date === cookDay)
                      .map((t) => (
                        <div key={t.id} className="space-y-3 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">
                                {t.name} {t.completed ? "· 조리 완료" : ""}
                              </p>
                              <p className="mt-1 text-sm">
                                조리일 {dateLabel(t.date)} · 만들 양 {t.servings}회분
                                {!t.completed ? ` · 아직 준비할 양 ${t.needed}회분` : ""}
                              </p>
                              {!t.completed && (
                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                  계획상 예상 여유 {Math.max(0, t.servings - t.needed)}회분. 실제
                                  양은 조리 완료 때 저장해요.
                                </p>
                              )}
                            </div>
                            {!t.completed && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label={`${t.name} 만들 양 줄이기`}
                                  disabled={busy || t.servings <= 1}
                                  onClick={() =>
                                    act("TASK", { taskId: t.id, servings: t.servings - 1 })
                                  }
                                >
                                  −
                                </Button>
                                <span>{t.servings}회분</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label={`${t.name} 만들 양 늘리기`}
                                  disabled={busy || t.servings >= 5}
                                  onClick={() =>
                                    act("TASK", { taskId: t.id, servings: t.servings + 1 })
                                  }
                                >
                                  ＋
                                </Button>
                              </div>
                            )}
                          </div>
                          {!t.completed && (
                            <details>
                              <summary className="cursor-pointer py-2 text-sm">
                                재료량 · 조리 완료 등록
                              </summary>
                              <ul className="my-3 space-y-1 text-sm">
                                {t.ingredients.map((i) => (
                                  <li key={i.id}>
                                    {i.name}{" "}
                                    {
                                      scaleIngredientAmount(
                                        i.amount,
                                        i.unit,
                                        t.baseServings,
                                        t.servings,
                                      ).displayAmount
                                    }
                                    {i.optional ? " (선택)" : ""}
                                  </li>
                                ))}
                              </ul>
                              {plan.status === "CONFIRMED" && (
                                <form
                                  className="grid items-end gap-3 sm:grid-cols-2"
                                  onSubmit={(ev) => {
                                    ev.preventDefault();
                                    const f = new FormData(ev.currentTarget);
                                    act("COOK", {
                                      taskId: t.id,
                                      servings: Number(f.get("servings")),
                                      location: f.get("location"),
                                      expiresDate: f.get("expiresDate"),
                                    });
                                  }}
                                >
                                  <label className="space-y-1">
                                    <span className="text-sm">실제로 만든 회분</span>
                                    <input
                                      className={field}
                                      name="servings"
                                      type="number"
                                      defaultValue={t.servings}
                                      min="0.1"
                                      step="0.1"
                                      max="5"
                                      required
                                    />
                                  </label>
                                  <label className="space-y-1">
                                    <span className="text-sm">보관 장소</span>
                                    <select name="location" className={field}>
                                      <option value="FRIDGE">냉장</option>
                                      <option value="FREEZER">냉동</option>
                                    </select>
                                  </label>
                                  <label className="space-y-1">
                                    <span className="text-sm">확인한 사용 기한</span>
                                    <input
                                      className={field}
                                      name="expiresDate"
                                      type="date"
                                      min={today}
                                      required
                                    />
                                  </label>
                                  <Button type="submit" disabled={busy || t.date > today}>
                                    조리 완료 · 음식 재고 저장
                                  </Button>
                                  <p className="text-sm text-[var(--color-text-secondary)] sm:col-span-2">
                                    이 음식의 예정 식사는 {dateLabel(t.requiredThrough)}까지예요.
                                    입력한 기한 안의 식사에만 예약하며, 보관 가능 기간을 자동으로
                                    보장하지 않습니다.
                                  </p>
                                </form>
                              )}
                            </details>
                          )}
                        </div>
                      ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
          <ShoppingPanel plan={plan} pantryIds={data.pantryIds} />
        </>
      )}
      {tab === "PLAN" && !plan && !wizard && (
        <div className={panel}>
          <p>아직 저장한 식단이 없어요.</p>
          <Button className="mt-4" onClick={() => setWizard(true)}>
            이번 주 식단 짜기
          </Button>
        </div>
      )}

      {tab === "STOCK" && (
        <>
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">만든 음식</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                조리한 식사와 간식을 회분으로 관리해요. 재료 목록은{" "}
                <Link href="/ingredients" className="underline">
                  내 냉장고
                </Link>
                에서 확인하세요.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "ALL", label: "전체" },
                { value: "MEAL", label: "식사" },
                { value: "SNACK", label: "간식" },
                { value: "FRIDGE", label: "냉장" },
                { value: "FREEZER", label: "냉동" },
              ].map((o) => (
                <Choice
                  key={o.value}
                  active={stockFilter === o.value}
                  onClick={() => setStockFilter(o.value)}
                >
                  {o.label}
                </Choice>
              ))}
            </div>
            {data.stock
              .filter(
                (s) =>
                  stockFilter === "ALL" || s.category === stockFilter || s.location === stockFilter,
              )
              .map((s) => (
                <div key={s.id} className={panel}>
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{s.name}</h3>
                      <p className="mt-1 text-sm">
                        {s.location === "FRIDGE" ? "냉장" : "냉동"} · 남은 {s.remaining}회분 · 예약{" "}
                        {s.reserved}회분 · 자유 수량 {Math.max(0, s.remaining - s.reserved)}회분
                      </p>
                      <p className="mt-1 text-sm">
                        만든 날 {s.preparedDate} · 사용 기한 {s.expiresDate ?? "확인 필요"}
                      </p>
                      {!s.usable && (
                        <p className="mt-2 text-sm text-[var(--color-warning-text)]">
                          기한·재료·레시피 확인이 필요해 자동 식단에 사용하지 않아요.
                        </p>
                      )}
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer py-2 text-sm">
                      꺼내기 · 폐기 · 수량 정정 · 보관 변경
                    </summary>
                    <form
                      className="mt-3 grid gap-3 sm:grid-cols-2"
                      onSubmit={async (ev) => {
                        ev.preventDefault();
                        const f = new FormData(ev.currentTarget);
                        const action = String(f.get("action"));
                        await run(
                          "/api/food-stock",
                          "PATCH",
                          {
                            id: s.id,
                            version: s.version,
                            action,
                            servings: Number(f.get("servings")),
                            eventKey: crypto.randomUUID(),
                            ...(action === "MOVE"
                              ? { location: f.get("location"), expiresDate: f.get("expiresDate") }
                              : {}),
                          },
                          "음식 재고를 반영했습니다.",
                        );
                      }}
                    >
                      <label className="space-y-1">
                        <span className="text-sm">작업</span>
                        <select className={field} name="action">
                          <option value="USE">재고에서 꺼내기 (식사 기록 별도)</option>
                          <option value="DISCARD">폐기</option>
                          <option value="ADJUST">남은 총량 정정</option>
                          <option value="MOVE">보관 장소·기한 변경</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm">회분 (정정은 남은 총량)</span>
                        <input
                          className={field}
                          type="number"
                          name="servings"
                          min="0.1"
                          step="0.1"
                          max="100"
                          defaultValue="1"
                          required
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm">변경할 보관 장소</span>
                        <select className={field} name="location" defaultValue={s.location}>
                          <option value="FRIDGE">냉장</option>
                          <option value="FREEZER">냉동</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm">변경할 사용 기한</span>
                        <input
                          className={field}
                          type="date"
                          name="expiresDate"
                          min={today}
                          defaultValue={s.expiresDate ?? ""}
                        />
                      </label>
                      <Button type="submit" disabled={busy}>
                        재고 반영
                      </Button>
                    </form>
                  </details>
                </div>
              ))}
            {!data.stock.length && (
              <p className={panel}>
                등록한 음식이 없어요. 조리 완료 후 저장하거나 아래에서 직접 추가해 주세요.
              </p>
            )}
          </section>
          <details className={panel}>
            <summary className="cursor-pointer py-1 font-semibold">
              이미 만든 음식 직접 등록
            </summary>
            <form
              className="mt-4 space-y-4"
              onSubmit={async (ev) => {
                ev.preventDefault();
                const form = ev.currentTarget;
                const f = new FormData(form);
                stockKey.current ??= crypto.randomUUID();
                const result = await run(
                  "/api/food-stock",
                  "POST",
                  {
                    name: f.get("name"),
                    category: f.get("category"),
                    location: f.get("location"),
                    servings: Number(f.get("servings")),
                    preparedDate: f.get("preparedDate"),
                    ...(f.get("recipeId") ? { recipeId: f.get("recipeId") } : {}),
                    ...(f.get("expiresDate") ? { expiresDate: f.get("expiresDate") } : {}),
                    eventKey: stockKey.current,
                  },
                  "음식을 재고에 등록했습니다.",
                );
                if (result) {
                  stockKey.current = null;
                  form.reset();
                }
              }}
            >
              <label className="block space-y-1">
                <span>음식 이름</span>
                <input className={field} name="name" maxLength={80} required />
              </label>
              <label className="block space-y-1">
                <span>레시피 연결 (선택)</span>
                {recipeSelect("recipeId", "", false)}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span>종류</span>
                  <select name="category" className={field}>
                    <option value="MEAL">식사</option>
                    <option value="SNACK">간식</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span>남은 회분</span>
                  <input
                    name="servings"
                    type="number"
                    className={field}
                    defaultValue="1"
                    min="0.1"
                    step="0.1"
                    max="100"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span>보관 장소</span>
                  <select name="location" className={field}>
                    <option value="FRIDGE">냉장</option>
                    <option value="FREEZER">냉동</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span>만든 날</span>
                  <input
                    name="preparedDate"
                    type="date"
                    className={field}
                    defaultValue={today}
                    max={today}
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span>확인한 사용 기한 (선택)</span>
                  <input name="expiresDate" type="date" className={field} min={today} />
                </label>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                레시피·성분이나 사용 기한을 모르는 음식은 자동 배치와 영양 계산에서 제외합니다.
              </p>
              <Button type="submit" disabled={busy}>
                음식 재고 저장
              </Button>
            </form>
          </details>
        </>
      )}
    </div>
  );
}

function NutritionPanel({
  plan,
  selectedDate,
  baby,
}: {
  plan: PlanView;
  selectedDate: string;
  baby: BabyProfileView;
}) {
  const [week, setWeek] = useState(false);
  const entries = plan.entries.filter((e) => week || e.date === selectedDate);
  const included = entries.filter(
    (e) => e.kind === "HOME" && e.recipeId && (e.snapshot as RecipeSnapshot).nutrition,
  );
  const nutrition = aggregateNutrition(
    included.map((e) => ({
      nutrition: (e.snapshot as RecipeSnapshot).nutrition,
      servings: e.servings,
    })),
  );
  const unresolved = entries.some((e) => e.kind === "HOME" && !e.recipeId);
  const external = entries.some((e) => e.kind === "EXTERNAL");
  const groups = new Set(included.flatMap((e) => (e.snapshot as RecipeSnapshot).groups));
  const age = currentAgeMonth(
    baby.ageMonthAtInput,
    new Date(`${baby.ageInputDate}T00:00:00Z`),
    new Date(`${selectedDate}T12:00:00Z`),
  );
  const reference = nutritionReference(age);
  return (
    <section className={panel}>
      <details>
        <summary className="cursor-pointer py-1 text-lg font-semibold">영양 체크</summary>
        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Choice active={!week} onClick={() => setWeek(false)}>
              선택한 하루
            </Choice>
            <Choice active={week} onClick={() => setWeek(true)}>
              한 주 합계
            </Choice>
          </div>
          <p className="text-sm">
            앱에 계획한 음식의 제공량 기준 추정치입니다.{" "}
            {external ? "어린이집·외식은 포함하지 않았어요. " : ""}
            {unresolved ? "빈 메뉴가 있어 일부 음식만 계산했어요." : ""}실제로 먹은 양과는 다를 수
            있어요.
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(groupLabels).map(([key, label]) => (
              <span
                key={key}
                className={`rounded-md border px-2 py-1 text-xs ${groups.has(key) ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}
              >
                {groups.has(key) ? "포함 · " : "미포함 · "}
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NUTRIENTS.map((n) => (
              <div key={n.key} className="rounded-md bg-[var(--color-surface-muted)] p-3">
                <p className="text-sm">{n.label}</p>
                <p className="mt-1 text-lg font-semibold">
                  {nutrition.values[n.key] === null
                    ? "계산 불가"
                    : `${nutrition.values[n.key]!.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}${n.unit}`}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {nutrition.coverage[n.key] < 1 || unresolved
                    ? "일부 재료만 계산"
                    : "재료 기준 추정"}
                </p>
              </div>
            ))}
          </div>
          {reference && (
            <div className="rounded-md border border-[var(--color-border)] p-3 text-sm">
              <p className="font-medium">
                하루 참고 기준 · {reference.ageLabel} · 2025 한국인 영양소 섭취기준
              </p>
              <p className="mt-2">
                권장섭취량: 단백질 {reference.protein}g · 철 {reference.iron}mg · 칼슘{" "}
                {reference.calcium}mg
              </p>
              <p className="mt-1">
                나트륨 충분섭취량 {reference.sodium}mg (상한이나 한 끼 목표가 아닙니다)
              </p>
              <p className="mt-2 text-[var(--color-text-secondary)]">
                전체 하루 음식에 대한 참고값이에요. 앱에 입력하지 않은 우유·간식·외부 식사를 포함해
                살펴보세요. 계획의 추정치만으로 영양 부족·충족을 판정하지 않습니다.
              </p>
              <a
                href={NUTRITION_REFERENCE_SOURCE}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block min-h-11 underline"
              >
                섭취기준 원문 보기
              </a>
            </div>
          )}
          {!groups.has("VEGETABLE") && included.length > 0 && (
            <p className="text-sm">
              계획한 음식에 채소가 없어요. 채소를 포함한 메뉴를 추가하거나 바꿔 보세요.
            </p>
          )}
          {!["MEAT", "SEAFOOD", "EGG", "LEGUME_TOFU"].some((g) => groups.has(g)) &&
            included.length > 0 && (
              <p className="text-sm">
                고기·생선·달걀·콩류가 포함되지 않았어요. 단백질 식품을 함께 살펴보세요.
              </p>
            )}
          {!!nutrition.missing.length && (
            <p className="text-sm text-[var(--color-warning-text)]">
              성분·분량 확인 필요: {nutrition.missing.join(", ")}
            </p>
          )}
          <p className="text-sm text-[var(--color-text-secondary)]">
            성분은 표준 식품 자료를 적용한 추정치이며, 국내 제품·품종·조리 후 성분과 다를 수 있어요.
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            식품군 포함 여부만으로 필수 영양소가 충분하다고 판단하지 않습니다. 누락된 음식·성분을
            0으로 계산하지 않으며, 하루 전체의 충족률은 표시하지 않아요.
          </p>
          {nutrition.sources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="mr-3 inline-block min-h-11 text-sm underline"
            >
              성분 근거: {s.title}
            </a>
          ))}
        </div>
      </details>
    </section>
  );
}

function ShoppingPanel({ plan, pantryIds }: { plan: PlanView; pantryIds: string[] }) {
  const totals = new Map<
    string,
    { name: string; unit: string; amount: number | null; owned: boolean }
  >();
  for (const task of plan.tasks.filter((t) => !t.completed))
    for (const i of task.ingredients.filter((i) => !i.optional)) {
      const key = `${i.id}:${i.unit}`;
      const item = totals.get(key) ?? {
        name: i.name,
        unit: i.unit,
        amount: 0,
        owned: pantryIds.includes(i.id),
      };
      item.amount =
        item.amount === null || i.amount === null
          ? null
          : item.amount + (i.amount * task.servings) / task.baseServings;
      totals.set(key, item);
    }
  return (
    <details className={panel}>
      <summary className="cursor-pointer py-1 text-lg font-semibold">장보기 · 준비할 재료</summary>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
        아직 만들지 않은 조리 묶음의 재료량을 합산했어요. 보유 중인 재료도 실제 수량을 확인해
        주세요.
      </p>
      <ul className="mt-4 divide-y divide-[var(--color-border)]">
        {[...totals.entries()].map(([key, i]) => (
          <li key={key} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
            <span>
              {i.name}
              {i.owned ? " · 보유 중, 수량 확인" : " · 준비 필요"}
            </span>
            <span>
              {i.amount === null ? "분량 확인" : `${Number(i.amount.toFixed(2))}${i.unit}`}
            </span>
          </li>
        ))}
      </ul>
      {!totals.size && <p className="mt-4 text-sm">추가로 준비할 재료가 없어요.</p>}
    </details>
  );
}
