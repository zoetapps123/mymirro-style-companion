import { Button } from '@/components/ui/button';
import { Plus, Shirt } from 'lucide-react';
import { motion } from 'framer-motion';

interface OutfitEmptyStateV2Props {
  wardrobeItemCount: number;
  missingCategories?: string[];
  onAddItem: () => void;
  title?: string;
  subtitle?: string;
}

const DEFAULT_MISSING_CATEGORIES = ['Tops', 'Bottoms', 'Shoes', 'Accessories'];

export const OutfitEmptyStateV2 = ({
  wardrobeItemCount,
  missingCategories,
  onAddItem,
  title,
  subtitle,
}: OutfitEmptyStateV2Props) => {
  const displayTitle = title || (wardrobeItemCount < 2 
    ? "Your wardrobe needs more items"
    : "Not enough items for this occasion"
  );
  
  const displaySubtitle = subtitle || (wardrobeItemCount < 2
    ? "Add at least 2 items to start generating outfit ideas."
    : "Add these items to unlock better outfits:"
  );

  const displayCategories = missingCategories && missingCategories.length > 0 
    ? missingCategories 
    : DEFAULT_MISSING_CATEGORIES;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-12 px-6"
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="relative mb-6"
      >
        <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
          <Shirt className="w-10 h-10 text-muted-foreground" />
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <Plus className="w-4 h-4 text-primary" />
        </motion.div>
      </motion.div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-foreground mb-2 text-center">
        {displayTitle}
      </h3>

      {/* Subtitle */}
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
        {displaySubtitle}
      </p>

      {/* Missing Categories */}
      {displayCategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          {displayCategories.map((category, idx) => (
            <motion.span
              key={category}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border"
            >
              {category}
            </motion.span>
          ))}
        </motion.div>
      )}

      {/* CTA Button */}
      <Button
        onClick={onAddItem}
        className="rounded-full px-6 gap-2"
        size="lg"
      >
        <Plus className="w-4 h-4" />
        Add Item
      </Button>
    </motion.div>
  );
};

export default OutfitEmptyStateV2;
