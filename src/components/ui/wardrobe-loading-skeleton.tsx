import { Skeleton } from "@/components/ui/skeleton";

interface WardrobeLoadingSkeletonProps {
  message?: string;
  itemCount?: number;
}

export const WardrobeLoadingSkeleton = ({ 
  message = "Loading...",
  itemCount = 8 
}: WardrobeLoadingSkeletonProps) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <p className="text-center text-muted-foreground text-sm">{message}</p>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: itemCount }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
            <Skeleton className="h-3 w-1/2 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
};
