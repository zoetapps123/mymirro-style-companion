import { Skeleton } from "@/components/ui/skeleton";

export const OutfitSuggestionSkeleton = () => {
  return (
    <div className="space-y-8 p-6">
      {/* Occasion Section Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        <div className="flex gap-4 overflow-x-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[280px]">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Style Section Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        <div className="flex gap-4 overflow-x-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[280px]">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Anchor Item Section Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-32 rounded-xl flex-shrink-0" />
          ))}
        </div>
      </div>
    </div>
  );
};
