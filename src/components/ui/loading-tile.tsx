import { motion } from "framer-motion";

interface LoadingTileProps {
  label?: string;
  className?: string;
}

export const LoadingTile = ({ label = "extracting...", className = "" }: LoadingTileProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`aspect-[3/4] rounded-2xl overflow-hidden border-2 border-border/50 relative bg-muted/20 ${className}`}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-[shimmer_2s_infinite]" />
      
      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-background/40" />
      
      {/* Loading text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
    </motion.div>
  );
};

export const OutfitLoadingTile = ({ className = "" }: { className?: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl overflow-hidden border border-border bg-muted/10 ${className}`}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-[shimmer_2s_infinite]" />
      
      {/* Content skeleton */}
      <div className="relative p-4 space-y-3">
        <div className="h-48 rounded-xl bg-muted/30 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-muted/30 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-muted/30 rounded animate-pulse w-1/2" />
        </div>
      </div>
      
      {/* Loading indicator */}
      <div className="absolute top-4 right-4">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </motion.div>
  );
};
