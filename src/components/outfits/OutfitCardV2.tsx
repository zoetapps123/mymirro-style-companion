import { useState, useMemo } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { 
  generateOutfitTitle, 
  generateOutfitCaption, 
  getCategoryMaxHeight,
  orderItemsForSilhouette 
} from './outfitUtils';

interface OutfitItem {
  id: string;
  name: string;
  category: string;
  color?: string;
  fit_type?: string;
  processed_image_url?: string | null;
  image_url: string;
}

interface OutfitCardV2Props {
  outfitId?: string;
  outfitName?: string;
  occasion?: string | null;
  styleTag?: string | null;
  previewImageUrl?: string | null;
  items: OutfitItem[];
  isSaved?: boolean;
  onView?: () => void;
  onSave?: () => void;
  onCardClick?: () => void;
  showActions?: boolean;
}

export const OutfitCardV2 = ({
  outfitId,
  outfitName,
  occasion,
  styleTag,
  previewImageUrl,
  items,
  isSaved = false,
  onView,
  onSave,
  onCardClick,
  showActions = true,
}: OutfitCardV2Props) => {
  const [imageError, setImageError] = useState(false);
  
  // Generate title and caption (memoized for stability)
  const displayTitle = useMemo(() => 
    generateOutfitTitle(occasion, styleTag, outfitName),
    [occasion, styleTag, outfitName]
  );
  
  const displayCaption = useMemo(() => 
    generateOutfitCaption(occasion, styleTag),
    [occasion, styleTag]
  );
  
  // Order items for silhouette display
  const orderedItems = useMemo(() => 
    orderItemsForSilhouette(items),
    [items]
  );

  const handleCardClick = () => {
    onCardClick?.();
  };

  // Render the silhouette composition (vertical stack of items)
  const renderSilhouetteComposition = () => {
    return (
      <div className="flex flex-col items-center justify-center gap-3 w-4/5 mx-auto py-3">
        {orderedItems.map((item, idx) => {
          const maxHeight = getCategoryMaxHeight(item.category);
          const imageUrl = item.processed_image_url || item.image_url;
          
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
              className="relative flex items-center justify-center w-full"
              style={{ maxHeight: `${maxHeight}px` }}
            >
              <img
                src={imageUrl}
                alt={item.name}
                loading="lazy"
                decoding="async"
                className="max-w-full object-contain drop-shadow-sm"
                style={{ 
                  maxHeight: `${maxHeight}px`,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))'
                }}
                onError={(e) => {
                  // Fallback to original image if processed fails
                  if (item.processed_image_url && e.currentTarget.src === item.processed_image_url) {
                    e.currentTarget.src = item.image_url;
                  }
                }}
              />
            </motion.div>
          );
        })}
      </div>
    );
  };

  // Render preview image if available
  const renderPreviewImage = () => {
    if (!previewImageUrl || imageError) {
      return renderSilhouetteComposition();
    }

    return (
      <img
        src={previewImageUrl}
        alt={displayTitle}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-contain"
        onError={() => setImageError(true)}
      />
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="group cursor-pointer"
      onClick={handleCardClick}
    >
      <div 
        className="relative rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.3) 100%)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          border: '1px solid hsl(var(--border) / 0.5)',
        }}
      >
        {/* Image/Silhouette Container */}
        <div className="relative aspect-[3/4] flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
          {renderPreviewImage()}
          
          {/* Saved indicator */}
          {isSaved && (
            <div className="absolute top-3 right-3">
              <Heart className="w-5 h-5 fill-primary text-primary" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          {/* Title */}
          <h4 className="font-semibold text-[15px] leading-tight truncate text-foreground">
            {displayTitle}
          </h4>
          
          {/* Caption */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {displayCaption}
          </p>

          {/* Actions */}
          {showActions && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onView?.();
                }}
              >
                View
              </Button>
              <Button
                variant={isSaved ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs h-8 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onSave?.();
                }}
                disabled={isSaved}
              >
                <Heart className={`w-3.5 h-3.5 mr-1 ${isSaved ? 'fill-current' : ''}`} />
                {isSaved ? 'Saved' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Loading skeleton for OutfitCardV2
export const OutfitCardV2Skeleton = () => {
  return (
    <div className="rounded-xl overflow-hidden" style={{
      background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.3) 100%)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      border: '1px solid hsl(var(--border) / 0.5)',
    }}>
      <div className="aspect-[3/4] p-4 flex flex-col items-center justify-center gap-3">
        <div className="w-3/4 h-24 bg-muted/50 rounded-lg animate-pulse" />
        <div className="w-2/3 h-28 bg-muted/50 rounded-lg animate-pulse" />
        <div className="w-1/2 h-16 bg-muted/50 rounded-lg animate-pulse" />
      </div>
      <div className="p-4 space-y-3">
        <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-muted/50 rounded animate-pulse w-full" />
        <div className="flex gap-2 pt-2">
          <div className="h-8 bg-muted/50 rounded-lg animate-pulse flex-1" />
          <div className="h-8 bg-muted/50 rounded-lg animate-pulse flex-1" />
        </div>
      </div>
    </div>
  );
};

export default OutfitCardV2;
