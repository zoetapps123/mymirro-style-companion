import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { orderOutfitForDisplay } from '@/lib/utils';
import { WardrobeItem } from '@/hooks/useWardrobeItems';
import { WardrobeInsufficientPrompt } from './WardrobeInsufficientPrompt';

interface WardrobeItemsDisplayProps {
  itemIds?: string[];
  items?: WardrobeItem[];
  context: string;
}

export const WardrobeItemsDisplay = ({ itemIds, items: preloadedItems, context }: WardrobeItemsDisplayProps) => {
  const [items, setItems] = useState<WardrobeItem[]>(preloadedItems || []);
  const [loading, setLoading] = useState(!preloadedItems);

  useEffect(() => {
    // Only fetch if no preloaded items and itemIds provided
    if (preloadedItems && preloadedItems.length > 0) {
      setItems(preloadedItems);
      setLoading(false);
      return;
    }
    
    if (!itemIds || itemIds.length === 0) {
      setLoading(false);
      return;
    }
    
    const fetchItems = async () => {
      const { data, error } = await supabase
        .from('wardrobe_items')
        .select('*')
        .in('id', itemIds);

      if (error) {
        console.error('Error fetching wardrobe items:', error);
        setLoading(false);
        return;
      }

      setItems(data || []);
      setLoading(false);
    };

    fetchItems();
  }, [itemIds, preloadedItems]);

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-32 h-40 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 my-3">
      <p className="text-sm text-muted-foreground italic">{context}</p>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {items.map(item => (
          <Card key={item.id} className="flex-shrink-0 w-32 overflow-hidden">
            <div className="aspect-[3/4] bg-white p-2 relative">
              <img
                src={item.processed_image_url || item.image_url}
                alt={item.name}
                className="w-full h-full object-contain"
              />
              {item.formality_level && (
                <Badge 
                  variant="secondary" 
                  className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 h-auto"
                >
                  {item.formality_level}
                </Badge>
              )}
            </div>
            <div className="p-2 bg-card space-y-1">
              <p className="text-xs font-medium truncate">{item.name}</p>
              {item.suitable_occasions && item.suitable_occasions.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {item.suitable_occasions.slice(0, 2).map((occasion, idx) => (
                    <Badge 
                      key={idx}
                      variant="outline" 
                      className="text-[9px] px-1 py-0 h-auto leading-tight"
                    >
                      {occasion}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface OutfitData {
  outfit_name: string;
  item_ids: string[];
  reasoning: string;
}

interface OutfitSuggestionDisplayProps {
  outfitName?: string;
  itemIds?: string[];
  reasoning?: string;
  outfits?: OutfitData[];
}

export const OutfitSuggestionDisplay = ({ outfitName, itemIds, reasoning, outfits }: OutfitSuggestionDisplayProps) => {
  // If outfits array is provided, render carousel
  if (outfits && outfits.length > 0) {
    return <MultipleOutfitsDisplay outfits={outfits} />;
  }
  
  // Otherwise render single outfit (backward compatibility)
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      if (!itemIds || itemIds.length === 0) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('wardrobe_items')
        .select('*')
        .in('id', itemIds);
      
      setItems(data || []);
      setLoading(false);
    };
    fetchItems();
  }, [itemIds]);

  if (loading) {
    return (
      <Card className="p-4 my-3">
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      </Card>
    );
  }

  // Use shared utility to organize items with accessories prioritized
  const displayItems = orderOutfitForDisplay(items);

  return (
    <Card className="p-3 my-3 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-sm">{outfitName}</h4>
      </div>
      
      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex flex-wrap gap-1.5 justify-center">
          {displayItems.map(item => (
            <div key={item.id} className="w-[calc(50%-3px)] aspect-square flex items-center justify-center p-1 bg-background rounded relative group">
              <img
                src={item.processed_image_url || item.image_url}
                alt={item.name}
                className="max-w-full max-h-full object-contain"
              />
              {item.formality_level && (
                <Badge 
                  variant="secondary" 
                  className="absolute top-1 right-1 text-[9px] px-1 py-0.5 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {item.formality_level}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic leading-tight">{reasoning}</p>
    </Card>
  );
};

// Component for displaying multiple outfits in a carousel
const MultipleOutfitsDisplay = ({ outfits }: { outfits: OutfitData[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [api, setApi] = useState<any>();

  useEffect(() => {
    if (!api) return;
    
    api.on('select', () => {
      setCurrentIndex(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <Card className="p-3 my-3 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-sm">Your Outfits</h4>
        </div>
        <span className="text-xs text-muted-foreground">
          {currentIndex + 1} of {outfits.length}
        </span>
      </div>
      
      <div className="relative px-8">
        <Carousel 
          className="w-full"
          opts={{ loop: true }}
          setApi={setApi}
        >
          <CarouselContent className="-ml-1">
            {outfits.map((outfit, idx) => (
              <CarouselItem key={idx} className="pl-1">
                <SingleOutfitCard
                  outfitName={outfit.outfit_name}
                  itemIds={outfit.item_ids}
                  reasoning={outfit.reasoning}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {outfits.length > 1 && (
            <>
              <CarouselPrevious className="left-0 h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background" />
              <CarouselNext className="right-0 h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background" />
            </>
          )}
        </Carousel>
      </div>
    </Card>
  );
};

// Individual outfit card within carousel
const SingleOutfitCard = ({ outfitName, itemIds, reasoning }: { outfitName: string; itemIds: string[]; reasoning: string }) => {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      const { data } = await supabase
        .from('wardrobe_items')
        .select('*')
        .in('id', itemIds);
      
      setItems(data || []);
      setLoading(false);
    };
    fetchItems();
  }, [itemIds]);

  if (loading) {
    return <div className="h-48 bg-muted rounded-xl animate-pulse" />;
  }

  // Use shared utility to organize items with accessories prioritized
  const displayItems = orderOutfitForDisplay(items);

  return (
    <div className="space-y-2">
      <h5 className="font-semibold text-center text-sm">{outfitName}</h5>
      <div className="bg-white rounded-lg p-2">
        <div className="flex flex-wrap gap-1.5 justify-center">
          {displayItems.map(item => (
            <div key={item.id} className="w-[calc(50%-3px)] aspect-square flex items-center justify-center p-1 bg-background rounded relative group">
              <img
                src={item.processed_image_url || item.image_url}
                alt={item.name}
                className="max-w-full max-h-full object-contain"
              />
              {item.formality_level && (
                <Badge 
                  variant="secondary" 
                  className="absolute top-1 right-1 text-[9px] px-1 py-0.5 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {item.formality_level}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground italic leading-tight">{reasoning}</p>
    </div>
  );
};
