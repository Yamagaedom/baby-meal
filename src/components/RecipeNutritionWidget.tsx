"use client";

import { computeNutritionPercentages, INFANT_MEAL_RDA } from "@/features/nutrition";
import type { RecipeNutritionFacts } from "@/lib/domain/types";

interface RecipeNutritionWidgetProps {
  nutrition: RecipeNutritionFacts | null;
  targetServings: number;
}

export function RecipeNutritionWidget({
  nutrition,
  targetServings,
}: RecipeNutritionWidgetProps) {
  if (!nutrition) return null;

  const pct = computeNutritionPercentages(nutrition);
  const totalMacro =
    nutrition.carbohydrateG * 4 + nutrition.proteinG * 4 + nutrition.fatG * 9;
  const carbRatio =
    totalMacro > 0 ? Math.round(((nutrition.carbohydrateG * 4) / totalMacro) * 100) : 55;
  const proteinRatio =
    totalMacro > 0 ? Math.round(((nutrition.proteinG * 4) / totalMacro) * 100) : 20;
  const fatRatio =
    totalMacro > 0 ? Math.round(((nutrition.fatG * 9) / totalMacro) * 100) : 25;

  return (
    <section
      data-testid="recipe-nutrition-section"
      className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-border)] pb-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            영양 성분 분석표
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            1회 제공량(1인분) 기준 · 영유아(12~48개월) 1끼 권장량 대비
          </p>
        </div>
        <span className="rounded bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
          {targetServings}인분 조리 중 1인분
        </span>
      </div>

      {/* 4대 핵심 지표 카드 */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3 text-center">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)]">
            열량 (에너지)
          </span>
          <span className="mt-1 block text-lg font-bold text-[var(--color-text)]">
            {nutrition.caloriesKcal}{" "}
            <span className="text-xs font-normal text-[var(--color-text-secondary)]">kcal</span>
          </span>
          <span className="mt-0.5 block text-[11px] font-semibold text-[var(--color-primary-text)]">
            1끼 권장의 {pct.caloriesPercent}%
          </span>
        </div>

        <div className="rounded-md bg-[var(--color-surface-muted)] p-3 text-center">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)]">
            단백질 (근육·성장)
          </span>
          <span className="mt-1 block text-lg font-bold text-[var(--color-text)]">
            {nutrition.proteinG}{" "}
            <span className="text-xs font-normal text-[var(--color-text-secondary)]">g</span>
          </span>
          <span className="mt-0.5 block text-[11px] font-semibold text-[var(--color-primary-text)]">
            1끼 권장의 {pct.proteinPercent}%
          </span>
        </div>

        <div className="rounded-md bg-[var(--color-surface-muted)] p-3 text-center">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)]">
            칼슘 (뼈·치아)
          </span>
          <span className="mt-1 block text-lg font-bold text-[var(--color-text)]">
            {nutrition.calciumMg}{" "}
            <span className="text-xs font-normal text-[var(--color-text-secondary)]">mg</span>
          </span>
          <span className="mt-0.5 block text-[11px] font-semibold text-[var(--color-primary-text)]">
            1끼 권장의 {pct.calciumPercent}%
          </span>
        </div>

        <div className="rounded-md bg-[var(--color-surface-muted)] p-3 text-center">
          <span className="block text-xs font-medium text-[var(--color-text-secondary)]">
            철분 (빈혈 예방)
          </span>
          <span className="mt-1 block text-lg font-bold text-[var(--color-text)]">
            {nutrition.ironMg}{" "}
            <span className="text-xs font-normal text-[var(--color-text-secondary)]">mg</span>
          </span>
          <span className="mt-0.5 block text-[11px] font-semibold text-[var(--color-primary-text)]">
            1끼 권장의 {pct.ironPercent}%
          </span>
        </div>
      </div>

      {/* 탄/단/지 매크로 밸런스 바 */}
      <div className="mt-5 space-y-2 rounded-md border border-[var(--color-border)] p-3.5">
        <div className="flex justify-between text-xs font-semibold text-[var(--color-text)]">
          <span>탄수화물 {nutrition.carbohydrateG}g ({carbRatio}%)</span>
          <span>단백질 {nutrition.proteinG}g ({proteinRatio}%)</span>
          <span>지방 {nutrition.fatG}g ({fatRatio}%)</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            style={{ width: `${carbRatio}%` }}
            className="bg-amber-400 transition-all"
            title={`탄수화물 ${carbRatio}%`}
          />
          <div
            style={{ width: `${proteinRatio}%` }}
            className="bg-emerald-500 transition-all"
            title={`단백질 ${proteinRatio}%`}
          />
          <div
            style={{ width: `${fatRatio}%` }}
            className="bg-sky-400 transition-all"
            title={`지방 ${fatRatio}%`}
          />
        </div>
        <div className="flex justify-between pt-1 text-[11px] text-[var(--color-text-secondary)]">
          <span>
            나트륨:{" "}
            <strong className="text-[var(--color-text)]">{nutrition.sodiumMg} mg</strong> (1끼 기준 {INFANT_MEAL_RDA.sodiumMg}mg 이하)
          </span>
          <span>
            식이섬유:{" "}
            <strong className="text-[var(--color-text)]">{nutrition.dietaryFiberG} g</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
