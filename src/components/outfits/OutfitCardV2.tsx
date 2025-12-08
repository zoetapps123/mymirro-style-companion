import { useState, useMemo } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { 
  generateOutfitTitle, 
  generateOutfitCaption
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

  const handleCardClick = () => {
    onCardClick?.();
  };

  // Render the 2x2 grid composition (original layout)
  const renderGridComposition = () => {
    const displayItems = items.slice(0, 4);
    
    return (
      <div className="grid grid-cols-2 gap-2 w-full p-3">
        {displayItems.map((item, idx) => {
          const imageUrl = item.processed_image_url || item.image_url;
          
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
              className="aspect-square bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center"
            >
              <img
                src={imageUrl}
                alt={item.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain p-1"
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
      return renderGridComposition();
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
        {/* Image/Grid Container - Square aspect ratio */}
        <div className="relative aspect-square flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
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
      <div className="aspect-square p-3">
        <div className="grid grid-cols-2 gap-2 w-full h-full">
          <div className="bg-muted/50 rounded-lg animate-pulse" />
          <div className="bg-muted/50 rounded-lg animate-pulse" />
          <div className="bg-muted/50 rounded-lg animate-pulse" />
          <div className="bg-muted/50 rounded-lg animate-pulse" />
        </div>
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
