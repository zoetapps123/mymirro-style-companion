import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface OutfitsGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * Responsive grid layout for outfit cards
 * - Mobile (<768px): 2 columns, 12px gap
 * - Tablet (768-1024px): 2-3 columns
 * - Desktop (>1024px): 3 columns, 20-28px gap
 */
export const OutfitsGrid = ({ children, className }: OutfitsGridProps) => {
  return (
    <div 
      className={cn(
        "grid gap-3 sm:gap-4 lg:gap-6",
        "grid-cols-2 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
};

export default OutfitsGrid;
