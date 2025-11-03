import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  color: string;
  processed_image_url?: string;
  image_url: string;
}

interface WardrobeItemsDisplayProps {
  itemIds: string[];
  context: string;
}

export const WardrobeItemsDisplay = ({ itemIds, context }: WardrobeItemsDisplayProps) => {
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
            <div className="aspect-[3/4] bg-white p-2">
              <img
                src={item.processed_image_url || item.image_url}
                alt={item.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-2 bg-card">
              <p className="text-xs font-medium truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground truncate">{item.color}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface OutfitSuggestionDisplayProps {
  outfitName: string;
  itemIds: string[];
  reasoning: string;
}

export const OutfitSuggestionDisplay = ({ outfitName, itemIds, reasoning }: OutfitSuggestionDisplayProps) => {
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
    return (
      <Card className="p-4 my-3">
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      </Card>
    );
  }

  return (
    <Card className="p-4 my-3 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h4 className="font-semibold">{outfitName}</h4>
      </div>
      
      <div className="bg-white rounded-xl p-3 mb-3">
        <div className="grid grid-cols-2 gap-2">
          {items.slice(0, 4).map(item => (
            <div key={item.id} className="aspect-square flex items-center justify-center">
              <img
                src={item.processed_image_url || item.image_url}
                alt={item.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground italic">{reasoning}</p>
      
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map(item => (
          <span key={item.id} className="text-xs px-2 py-1 bg-background rounded-full">
            {item.name}
          </span>
        ))}
      </div>
    </Card>
  );
};
