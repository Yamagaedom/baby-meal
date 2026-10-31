import type { ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white px-6 py-10 text-center shadow-none">
      <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--color-text-secondary)]">
        {description}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`max-w-full min-w-0 animate-pulse rounded-md bg-[var(--color-skeleton)] ${className}`}
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
          className="space-y-3 rounded-lg border border-[var(--color-border)] bg-white p-5"
        >
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-14 rounded-sm" />
            <Skeleton className="h-6 w-20 rounded-sm" />
          </div>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
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
      className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] p-6 text-center"
    >
      <p className="text-base font-semibold text-[var(--color-danger-text)]">
        <Icon name="warning" className="mx-auto mb-2" />
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--color-danger-text)]">{message}</p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={onRetry}>
            다시 시도하기
          </Button>
        </div>
      )}
    </div>
  );
}
