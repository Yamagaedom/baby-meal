"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, EmptyState, ErrorState, Skeleton, Tabs } from "@/components/ui";
import type { MealLogItemView, RecipeLogSummaryView, TasteReportView } from "@/features/meal-log";
import { INGREDIENT_GROUP_LABELS, MEAL_TIME_LABELS } from "@/features/recipe/constants-client";
import type { MealTime } from "@/lib/domain/types";

interface MealLogsClientProps {
  babyId: string;
  babyName: string;
  initialYearMonth: string;
  initialCalendarByDate: Record<string, MealLogItemView[]>;
  initialByRecipe: RecipeLogSummaryView[];
  initialTasteReport: TasteReportView;
}

const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const RATING_TEXT = {
  GOOD: "잘 먹음",
  OK: "보통",
  REFUSED: "안 먹음",
};

function buildCalendarCells(yearMonth: string) {
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) return [];

  const firstDayWeek = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (string | null)[] = [];

  for (let i = 0; i < firstDayWeek; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${yearMonth}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

export function MealLogsClient({
  babyId,
  babyName,
  initialYearMonth,
  initialCalendarByDate,
  initialByRecipe,
  initialTasteReport,
}: MealLogsClientProps) {
  const [tab, setTab] = useState<"calendar" | "recipe" | "report">("calendar");
  const [yearMonth, setYearMonth] = useState(initialYearMonth);
  const [calendarByDate, setCalendarByDate] = useState(initialCalendarByDate);
  const [byRecipe, setByRecipe] = useState(initialByRecipe);
  const [tasteReport, setTasteReport] = useState(initialTasteReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMonthChange(nextMonth: string) {
    setYearMonth(nextMonth);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/meal-logs?babyId=${encodeURIComponent(babyId)}&yearMonth=${encodeURIComponent(nextMonth)}`,
      );
      if (!res.ok) {
        setError("식단 기록을 불러오지 못했어요.");
        return;
      }
      const data = await res.json();
      setCalendarByDate(data.calendarByDate ?? {});
      setByRecipe(data.byRecipe ?? []);
      if (data.tasteReport) setTasteReport(data.tasteReport);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  const dates = Object.keys(calendarByDate).sort((a, b) => b.localeCompare(a));
  const calendarCells = buildCalendarCells(yearMonth);
  const maxMenuGood = Math.max(1, ...tasteReport.topMenus.map((m) => m.goodCount));
  const maxIngGood = Math.max(1, ...tasteReport.topIngredients.map((i) => i.goodCount));

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-[var(--color-text)] sm:text-[32px]">
            {babyName}의 먹은 기록
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            날짜별 식단 캘린더, 메뉴별 누적 평가, 입맛 리포트를 한눈에 확인하세요.
          </p>
        </div>

        <Tabs
          ariaLabel="기록 보기 방식"
          value={tab}
          onChange={setTab}
          options={[
            { id: "calendar", label: "날짜별 보기" },
            { id: "recipe", label: "메뉴별 누적 보기" },
            { id: "report", label: "입맛 리포트" },
          ]}
        />
      </section>

      {error && <ErrorState message={error} onRetry={() => void handleMonthChange(yearMonth)} />}

      {loading && (
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-white p-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-44 w-full" />
        </div>
      )}

      {!loading && tab === "calendar" && (
        <section className="space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
              <label
                htmlFor="log-month-picker"
                className="text-sm font-semibold text-[var(--color-text)]"
              >
                조회 월 선택
              </label>
              <input
                id="log-month-picker"
                type="month"
                value={yearMonth}
                disabled={loading}
                onChange={(e) => void handleMonthChange(e.target.value)}
                className="min-h-11 max-w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3 py-2 text-sm font-semibold text-[var(--color-text)]"
              />
            </div>

            {/* 날짜를 격자로 정렬하고 기록 건수를 텍스트로 표시합니다. */}
            <div
              aria-label={`${yearMonth} 식단 평가 달력`}
              className="grid grid-cols-7 border-t border-l border-[var(--color-border)] text-center"
            >
              {WEEKDAY_HEADERS.map((wd) => (
                <div
                  key={wd}
                  className="min-w-0 border-r border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] py-2 text-xs font-semibold text-[var(--color-text-secondary)]"
                >
                  {wd}
                </div>
              ))}
              {calendarCells.map((dateKey, idx) => {
                if (!dateKey) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-16 min-w-0 border-r border-b border-[var(--color-border)]"
                    />
                  );
                }
                const dayLogs = calendarByDate[dateKey] ?? [];
                const dayNum = Number(dateKey.slice(-2));
                return (
                  <div
                    key={dateKey}
                    data-testid={`calendar-day-${dateKey}`}
                    className={`flex min-h-16 min-w-0 flex-col items-center justify-start border-r border-b border-[var(--color-border)] p-1.5 text-xs ${
                      dayLogs.length > 0
                        ? "bg-[var(--color-primary-soft)]/45 font-semibold text-[var(--color-text)]"
                        : "bg-white text-[var(--color-text-secondary)]"
                    }`}
                  >
                    <span>{dayNum}</span>
                    {dayLogs.length > 0 && (
                      <a
                        href={`#meal-log-${dateKey}`}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-sm text-xs leading-tight font-semibold text-[var(--color-primary-text)] underline underline-offset-2"
                        aria-label={`${dayLogs.length}건 기록: ${dayLogs
                          .map((l) => RATING_TEXT[l.rating])
                          .join(", ")}`}
                      >
                        {dayLogs.length}건
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {dates.length === 0 ? (
            <EmptyState
              title="선택한 월에 저장된 식사 기록이 없어요"
              description="레시피 상세 화면에서 '먹었어요 저장'을 눌러 첫 식단 기록을 남겨보세요."
            />
          ) : (
            <div className="space-y-4">
              {dates.map((dateStr) => (
                <div
                  key={dateStr}
                  id={`meal-log-${dateStr}`}
                  className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none"
                >
                  <h2 className="text-base font-semibold text-[var(--color-text)]">{dateStr}</h2>
                  <ul className="mt-2.5 divide-y divide-[var(--color-border)]">
                    {calendarByDate[dateStr].map((log) => (
                      <li key={log.id} className="py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {log.mealTime && (
                              <Badge variant="neutral">
                                {MEAL_TIME_LABELS[log.mealTime as MealTime] ?? log.mealTime}
                              </Badge>
                            )}
                            <Link
                              href={`/recipes/${log.recipeId}`}
                              className="font-semibold text-[var(--color-text)] underline-offset-4 hover:text-[var(--color-primary)] hover:underline"
                            >
                              {log.recipeName}
                            </Link>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant={
                                log.rating === "GOOD"
                                  ? "rating"
                                  : log.rating === "REFUSED"
                                    ? "allergy"
                                    : "neutral"
                              }
                            >
                              {log.ratingLabel}
                            </Badge>
                            {log.amountEatenLabel && (
                              <Badge variant="neutral">{log.amountEatenLabel}</Badge>
                            )}
                          </div>
                        </div>
                        {log.memo && (
                          <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
                            메모: {log.memo}
                          </p>
                        )}
                        {log.reactions.length > 0 && (
                          <p className="mt-1.5 text-xs font-semibold text-[var(--color-danger-text)]">
                            이상 반응: {log.reactions.join(", ")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && tab === "recipe" && (
        <section className="space-y-3.5">
          {byRecipe.length === 0 ? (
            <EmptyState
              title="아직 누적된 메뉴별 반응 기록이 없어요"
              description="아기가 먹은 메뉴 반응을 기록하면 메뉴별 통계가 이곳에 쌓입니다."
            />
          ) : (
            <div className="space-y-3">
              {byRecipe.map((summary) => (
                <div
                  key={summary.recipeId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none"
                >
                  <div>
                    <Link
                      href={`/recipes/${summary.recipeId}`}
                      className="text-base font-semibold text-[var(--color-text)] underline-offset-4 hover:text-[var(--color-primary)] hover:underline"
                    >
                      {summary.recipeName}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      최근 섭취일: {summary.lastEatenDate} · 총 {summary.totalCount}회 기록
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="rating">잘 먹음 {summary.goodCount}회</Badge>
                    <Badge variant="neutral">보통 {summary.okCount}회</Badge>
                    <Badge variant="allergy">안 먹음 {summary.refusedCount}회</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* LOG-07: 입맛 리포트 (막대 차트 시각화 포함) */}
      {!loading && tab === "report" && (
        <section data-testid="taste-report-section" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none">
              <h2 className="text-base font-semibold text-[var(--color-text)]">잘 먹은 TOP 메뉴</h2>
              {tasteReport.topMenus.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                  아직 &ldquo;잘 먹었어요&rdquo; 기록이 없습니다.
                </p>
              ) : (
                <ul className="mt-3 space-y-3 text-sm">
                  {tasteReport.topMenus.map((m) => {
                    const widthPct = Math.round((m.goodCount / maxMenuGood) * 100);
                    return (
                      <li key={m.recipeId} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/recipes/${m.recipeId}`}
                            className="font-semibold text-[var(--color-text)] underline underline-offset-4"
                          >
                            {m.recipeName}
                          </Link>
                          <span className="text-xs font-semibold text-[var(--color-secondary-text)]">
                            잘 먹음 {m.goodCount}회
                          </span>
                        </div>
                        <div
                          aria-hidden="true"
                          className="h-2.5 w-full overflow-hidden rounded-sm bg-[var(--color-secondary-soft)]"
                        >
                          <div
                            className="h-full rounded-sm bg-[var(--color-secondary)]"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                잘 먹은 TOP 식재료
              </h2>
              {tasteReport.topIngredients.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                  데이터가 아직 부족합니다.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5 text-sm">
                  {tasteReport.topIngredients.map((ing) => {
                    const widthPct = Math.round((ing.goodCount / maxIngGood) * 100);
                    return (
                      <li key={ing.ingredientId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-[var(--color-text)]">{ing.name}</span>
                          <span className="text-[var(--color-primary-text)]">
                            {ing.goodCount}회
                          </span>
                        </div>
                        <div
                          aria-hidden="true"
                          className="h-2.5 w-full overflow-hidden rounded-sm bg-[var(--color-primary-soft)]"
                        >
                          <div
                            className="h-full rounded-sm bg-[var(--color-primary)]"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                거부 반응이 있었던 식재료
              </h2>
              {tasteReport.refusedIngredients.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                  거부 기록된 식재료가 없습니다.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tasteReport.refusedIngredients.map((ing) => (
                    <Badge key={ing.ingredientId} variant="allergy">
                      {ing.name} (안 먹음 {ing.refusedCount}회)
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-none">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                아직 시도 안 한 추천 식재료
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                월령과 알레르기 필터를 통과한 안전 식재료입니다. 처음 먹일 때는 소량부터 시도하세요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tasteReport.untriedIngredients.map((ing) => (
                  <Badge key={ing.ingredientId} variant="salt">
                    {ing.name} · {INGREDIENT_GROUP_LABELS[ing.group]}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
