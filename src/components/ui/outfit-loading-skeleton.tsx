import { Skeleton } from "@/components/ui/skeleton";

interface OutfitGridLoadingSkeletonProps {
  message?: string;
  outfitCount?: number;
}

export const OutfitGridLoadingSkeleton = ({ 
  message = "Loading outfits...",
  outfitCount = 4 
}: OutfitGridLoadingSkeletonProps) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <p className="text-center text-muted-foreground text-sm">{message}</p>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: outfitCount }).map((_, i) => (
          <div key={i} className="space-y-3 p-4 rounded-xl border border-border bg-card">
            <Skeleton className="h-40 w-full rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
