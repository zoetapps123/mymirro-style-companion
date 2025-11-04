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

  // Organize items by category for proper outfit display
  const categorizeItems = () => {
    const upperwear = items.find(i => ['shirt', 'top', 'blouse', 'tshirt', 't-shirt', 'upperwear'].some(cat => i.category.toLowerCase().includes(cat)));
    const lowerwear = items.find(i => ['pants', 'jeans', 'trousers', 'skirt', 'shorts', 'lowerwear'].some(cat => i.category.toLowerCase().includes(cat)));
    const footwear = items.find(i => ['shoes', 'sneakers', 'boots', 'sandals', 'heels', 'footwear'].some(cat => i.category.toLowerCase().includes(cat)));
    const layering = items.find(i => ['jacket', 'blazer', 'cardigan', 'coat', 'sweater', 'hoodie', 'outerwear'].some(cat => i.category.toLowerCase().includes(cat)));
    const accessories = items.filter(i => 
      !upperwear || i.id !== upperwear.id &&
      !lowerwear || i.id !== lowerwear.id &&
      !footwear || i.id !== footwear.id &&
      !layering || i.id !== layering.id
    );
    
    return [upperwear, lowerwear, layering, footwear, ...accessories].filter(Boolean) as WardrobeItem[];
  };

  const displayItems = categorizeItems().slice(0, 4);

  return (
    <Card className="p-4 my-3 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h4 className="font-semibold">{outfitName}</h4>
      </div>
      
      <div className="bg-white rounded-xl p-3 mb-3">
        <div className="grid grid-cols-2 gap-2">
          {displayItems.map(item => (
            <div key={item.id} className="aspect-square flex items-center justify-center p-2">
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
    </Card>
  );
};
