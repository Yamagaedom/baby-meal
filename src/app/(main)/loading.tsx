import { RecipeCardSkeleton, Skeleton } from "@/components/ui";

export default function MainLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="화면을 불러오는 중입니다">
      <div className="rounded-lg border border-[var(--color-border)] bg-white p-5">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <RecipeCardSkeleton count={4} />
    </div>
  );
}
