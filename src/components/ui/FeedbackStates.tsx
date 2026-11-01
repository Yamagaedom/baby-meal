import type { ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center shadow-none sm:py-16">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
        {icon ?? <Icon name="book" width={28} height={28} />}
      </div>
      <h3 className="text-lg font-bold tracking-tight text-[var(--color-text)] sm:text-xl">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {description}
      </p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`max-w-full min-w-0 animate-shimmer rounded-md bg-[var(--color-skeleton)] ${className}`}
    />
  );
}

export function RecipeCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="레시피 목록을 불러오는 중입니다"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col justify-between space-y-4 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-none"
        >
          <div className="space-y-3">
            {/* 뱃지 2개 및 하트 영역 */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            {/* 레시피 제목 */}
            <Skeleton className="h-6 w-3/4 rounded-md" />
            {/* 한 줄 설명 */}
            <div className="space-y-1.5 pt-1">
              <Skeleton className="h-4 w-full rounded-sm" />
              <Skeleton className="h-4 w-4/5 rounded-sm" />
            </div>
          </div>

          {/* 하단 메타 정보 (조리시간 + 별점) */}
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
            <Skeleton className="h-4 w-20 rounded-sm" />
            <Skeleton className="h-4 w-24 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "화면을 불러오지 못했어요",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-8 text-center"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--color-danger)] shadow-xs">
        <Icon name="warning" width={24} height={24} />
      </div>
      <p className="text-base font-bold text-[var(--color-danger-text)]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--color-danger-text)]">{message}</p>
      {onRetry && (
        <div className="mt-5 flex justify-center">
          <Button variant="outline" size="sm" onClick={onRetry}>
            다시 시도하기
          </Button>
        </div>
      )}
    </div>
  );
}
