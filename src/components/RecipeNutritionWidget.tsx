import type { RecipeNutritionFacts } from "@/lib/domain/types";
export function RecipeNutritionWidget({
  nutrition,
  targetServings,
}: {
  nutrition: RecipeNutritionFacts | null;
  targetServings: number;
}) {
  if (!nutrition?.estimate) return null;
  const estimate = nutrition.estimate;
  const items = [
    ["열량", nutrition.caloriesKcal, "kcal", estimate.coverage.energy],
    ["단백질", nutrition.proteinG, "g", estimate.coverage.protein],
    ["칼슘", nutrition.calciumMg, "mg", estimate.coverage.calcium],
    ["철분", nutrition.ironMg, "mg", estimate.coverage.iron],
    ["탄수화물", nutrition.carbohydrateG, "g", estimate.coverage.carbohydrate],
    ["지방", nutrition.fatG, "g", estimate.coverage.fat],
    ["나트륨", nutrition.sodiumMg, "mg", estimate.coverage.sodium],
    ["식이섬유", nutrition.dietaryFiberG, "g", estimate.coverage.fiber],
  ] as const;
  return (
    <section
      data-testid="recipe-nutrition-section"
      className="rounded-lg border border-[var(--color-border)] bg-white p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-border)] pb-3">
        <div>
          <h2 className="text-lg font-semibold">영양 성분 추정</h2>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            1회분 기준 · 선택 재료 제외 · 식품 성분표로 계산한 참고값
          </p>
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {targetServings}회분 조리 중 1회분
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(([label, value, unit, coverage]) => (
          <div key={label} className="rounded-md bg-[var(--color-surface-muted)] p-3">
            <dt className="text-xs text-[var(--color-text-secondary)]">{label}</dt>
            <dd className="mt-1 font-semibold">{value === null ? "미확인" : value + " " + unit}</dd>
            {value !== null && coverage < 1 && (
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                확인된 재료의 부분 합계
              </p>
            )}
          </div>
        ))}
      </dl>
      {estimate.missing.length > 0 && (
        <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
          자료·중량 미확인: {estimate.missing.join(", ")}. 표시 값에 이 재료의 일부 성분이 빠져
          있습니다.
        </p>
      )}
      <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
        품종·제품·조리 손실에 따라 달라집니다. 한 메뉴의 수치만으로 하루 영양 충족을 판단하지
        않습니다.
      </p>
      <ul className="mt-2 text-xs text-[var(--color-text-secondary)]">
        {estimate.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
              {source.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
