import { useState, useEffect } from "react";
import { DoorOpen, Sparkles, Calendar, Shirt, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WardrobeOutfitSuggestionProps {
  onBack: () => void;
  onNavigate: (view: 'items' | 'suggestion' | 'calendar' | 'lookbook') => void;
}

interface OutfitPiece {
  useExisting: boolean;
  itemId?: string;
  itemName?: string;
  aiSuggestion?: string;
}

interface GeneratedOutfit {
  outfit: {
    top?: OutfitPiece;
    bottom?: OutfitPiece;
    layer?: OutfitPiece;
    shoes?: OutfitPiece;
    accessories?: OutfitPiece;
  };
  reasoning: string;
}

const WardrobeOutfitSuggestion = ({ onBack, onNavigate }: WardrobeOutfitSuggestionProps) => {
  const [selectedOccasion, setSelectedOccasion] = useState<string>("Daily");
  const [selectedStyle, setSelectedStyle] = useState<string>("Casual");
  const [myItems, setMyItems] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [selectedAnchor, setSelectedAnchor] = useState<any | null>(null);
  const [occasionOutfits, setOccasionOutfits] = useState<GeneratedOutfit[]>([]);
  const [styleOutfits, setStyleOutfits] = useState<GeneratedOutfit[]>([]);
  const [anchorOutfits, setAnchorOutfits] = useState<GeneratedOutfit[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  const occasions = ["Daily", "School", "Work", "Travel", "Party", "Wedding"];
  const styles = ["Casual", "Classic", "Street", "Minimal", "Athleisure"];

  const features = [
    { icon: DoorOpen, title: "Your\nCloset", view: 'items' as const, active: false },
    { icon: Sparkles, title: "Outfit\nSuggestion", view: 'suggestion' as const, active: true },
    { icon: Calendar, title: "Plan Your\nLook", view: 'calendar' as const, active: false },
    { icon: Shirt, title: "Your\nLookbook", view: 'lookbook' as const, active: false },
  ];

  useEffect(() => {
    fetchAllItems();
  }, []);

  useEffect(() => {
    if (allItems.length > 0 && !selectedAnchor) {
      setSelectedAnchor(allItems[0]);
    }
  }, [allItems]);

  useEffect(() => {
    if (selectedAnchor && allItems.length > 0) {
      console.log('Triggering outfit generation for anchor:', selectedAnchor.name);
      generateOutfitForAnchor();
    }
  }, [selectedAnchor]);

  const fetchAllItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("wardrobe_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    setAllItems(data || []);
    setMyItems((data || []).slice(0, 4));
  };

  const generateOutfit = async (occasion: string, style?: string, anchorItem?: any) => {
    try {
      console.log('Generating outfit with:', { occasion, style, anchorItem: anchorItem?.name, itemsCount: allItems.length });
      
      const { data, error } = await supabase.functions.invoke('generate-outfit', {
        body: {
          occasion: style || occasion,
          selectedItem: anchorItem || allItems[0],
          userItems: allItems,
        }
      });

      if (error) {
        console.error('Generate outfit error:', error);
        const status = (error as any)?.context?.response?.status;
        if (status === 429) {
          toast.error('Rate limited. Please try again in a minute.');
          return null;
        }
        if (status === 402) {
          toast.error('AI credits exhausted. Please try again later.');
          return null;
        }
        throw error;
      }
      
      console.log('Generated outfit data:', data);
      
      if (!data || !data.outfit) {
        console.error('Invalid outfit data received:', data);
        toast.error('Invalid outfit data received');
        return null;
      }
      
      return data as GeneratedOutfit;
    } catch (error) {
      console.error('Error generating outfit:', error);
      toast.error('Failed to generate outfit');
      return null;
    }
  };

  const generateOutfitsForOccasion = async (occasion: string) => {
    setLoading(prev => ({ ...prev, [occasion]: true }));
    try {
      const outfit1 = await generateOutfit(occasion);
      const outfit2 = await generateOutfit(occasion);
      
      const outfits = [outfit1, outfit2].filter(Boolean) as GeneratedOutfit[];
      setOccasionOutfits(outfits);
    } finally {
      setLoading(prev => ({ ...prev, [occasion]: false }));
    }
  };

  const generateOutfitsForStyle = async (style: string) => {
    setLoading(prev => ({ ...prev, [style]: true }));
    try {
      const outfit1 = await generateOutfit(`${style} style`);
      const outfit2 = await generateOutfit(`${style} style`);
      
      const outfits = [outfit1, outfit2].filter(Boolean) as GeneratedOutfit[];
      setStyleOutfits(outfits);
    } finally {
      setLoading(prev => ({ ...prev, [style]: false }));
    }
  };

  const generateOutfitForAnchor = async () => {
    if (!selectedAnchor) return;
    
    setLoading(prev => ({ ...prev, anchor: true }));
    try {
      const outfit1 = await generateOutfit('Casual', undefined, selectedAnchor);
      const outfit2 = await generateOutfit('Casual', undefined, selectedAnchor);
      
      const outfits = [outfit1, outfit2].filter(Boolean) as GeneratedOutfit[];
      setAnchorOutfits(outfits);
    } finally {
      setLoading(prev => ({ ...prev, anchor: false }));
    }
  };

  const saveOutfit = async (generatedOutfit: GeneratedOutfit, name: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create outfit record
      const { data: outfit, error: outfitError } = await supabase
        .from('outfits')
        .insert({
          user_id: user.id,
          name: name,
          occasion: selectedOccasion,
        })
        .select()
        .single();

      if (outfitError) throw outfitError;

      // Insert outfit items
      const itemsToInsert = [];
      const outfitData = generatedOutfit.outfit;

      if (outfitData.top) {
        itemsToInsert.push({
          outfit_id: outfit.id,
          item_id: outfitData.top.useExisting ? outfitData.top.itemId : null,
          item_type: 'Tops',
          ai_virtual: !outfitData.top.useExisting,
          ai_meta: outfitData.top.useExisting ? null : { suggestion: outfitData.top.aiSuggestion }
        });
      }

      if (outfitData.bottom) {
        itemsToInsert.push({
          outfit_id: outfit.id,
          item_id: outfitData.bottom.useExisting ? outfitData.bottom.itemId : null,
          item_type: 'Bottoms',
          ai_virtual: !outfitData.bottom.useExisting,
          ai_meta: outfitData.bottom.useExisting ? null : { suggestion: outfitData.bottom.aiSuggestion }
        });
      }

      if (outfitData.layer) {
        itemsToInsert.push({
          outfit_id: outfit.id,
          item_id: outfitData.layer.useExisting ? outfitData.layer.itemId : null,
          item_type: 'Layers',
          ai_virtual: !outfitData.layer.useExisting,
          ai_meta: outfitData.layer.useExisting ? null : { suggestion: outfitData.layer.aiSuggestion }
        });
      }

      if (outfitData.shoes) {
        itemsToInsert.push({
          outfit_id: outfit.id,
          item_id: outfitData.shoes.useExisting ? outfitData.shoes.itemId : null,
          item_type: 'Shoes',
          ai_virtual: !outfitData.shoes.useExisting,
          ai_meta: outfitData.shoes.useExisting ? null : { suggestion: outfitData.shoes.aiSuggestion }
        });
      }

      if (outfitData.accessories) {
        itemsToInsert.push({
          outfit_id: outfit.id,
          item_id: outfitData.accessories.useExisting ? outfitData.accessories.itemId : null,
          item_type: 'Accessories',
          ai_virtual: !outfitData.accessories.useExisting,
          ai_meta: outfitData.accessories.useExisting ? null : { suggestion: outfitData.accessories.aiSuggestion }
        });
      }

      const { error: itemsError } = await supabase
        .from('outfit_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success('Outfit saved to your lookbook!');
    } catch (error) {
      console.error('Error saving outfit:', error);
      toast.error('Failed to save outfit');
    }
  };

  const renderOutfitCard = (outfit: GeneratedOutfit | null, index: number, section: string) => {
    if (!outfit) {
      return (
        <div className="aspect-[3/4] rounded-2xl bg-muted border border-border flex items-center justify-center">
          {loading[section] && <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
        </div>
      );
    }

    const pieces = Object.entries(outfit.outfit).filter(([_, piece]) => piece);

    return (
      <div className="relative aspect-[3/4] rounded-2xl bg-gradient-to-br from-background to-muted border border-border p-3 flex flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto">
          {pieces.map(([type, piece]) => (
            <div key={type} className="text-xs">
              <span className="font-semibold capitalize text-primary">{type}:</span>{' '}
              <span className="text-muted-foreground">
                {piece.useExisting ? piece.itemName : piece.aiSuggestion}
              </span>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-2"
          onClick={() => saveOutfit(outfit, `${section} Outfit ${index + 1}`)}
        >
          <Save className="w-3 h-3 mr-1" />
          Save
        </Button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      {/* Feature Icons */}
      <div className="px-4 pt-6 pb-4">
        <div className="grid grid-cols-4 gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isActive = feature.active;
            return (
              <button
                key={feature.title}
                onClick={() => onNavigate(feature.view)}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                    isActive
                      ? "bg-primary border-2 border-primary"
                      : "bg-background border-2 border-border"
                  }`}
                >
                  <Icon
                    className={`w-7 h-7 ${
                      isActive ? "text-primary-foreground" : "text-muted-foreground"
                    }`}
                  />
                </div>
                <span className="text-xs font-medium text-center leading-tight whitespace-pre-line">
                  {feature.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Title */}
        <h2 className="text-2xl font-bold text-primary">Outfit Suggestions</h2>

        {/* Occasion */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-3">Occasion</h3>
          <div className="flex gap-2 flex-wrap mb-4">
            {occasions.map((occasion) => (
              <Button
                key={occasion}
                variant={selectedOccasion === occasion ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedOccasion(occasion);
                  generateOutfitsForOccasion(occasion);
                }}
                disabled={loading[occasion]}
                className="rounded-full"
              >
                {loading[occasion] && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {occasion}
              </Button>
            ))}
          </div>

          {/* Outfit Cards */}
          <div className="grid grid-cols-2 gap-3">
            {renderOutfitCard(occasionOutfits[0] || null, 0, selectedOccasion)}
            {renderOutfitCard(occasionOutfits[1] || null, 1, selectedOccasion)}
          </div>
        </div>

        {/* Style */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-3">Style</h3>
          <div className="flex gap-2 flex-wrap mb-4">
            {styles.map((style) => (
              <Button
                key={style}
                variant={selectedStyle === style ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedStyle(style);
                  generateOutfitsForStyle(style);
                }}
                disabled={loading[style]}
                className="rounded-full"
              >
                {loading[style] && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {style}
              </Button>
            ))}
          </div>

          {/* Outfit Cards */}
          <div className="grid grid-cols-2 gap-3">
            {renderOutfitCard(styleOutfits[0] || null, 0, selectedStyle)}
            {renderOutfitCard(styleOutfits[1] || null, 1, selectedStyle)}
          </div>
        </div>

        {/* From my items */}
        {allItems.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-primary mb-3">From my items</h3>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {myItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedAnchor(item)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selectedAnchor?.id === item.id
                      ? 'border-primary ring-2 ring-primary ring-offset-2'
                      : 'border-border'
                  }`}
                >
                  <img
                    src={item.processed_image_url || item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
              {Array.from({ length: Math.max(0, 4 - myItems.length) }).map((_, i) => (
                <div key={`placeholder-${i}`} className="aspect-square rounded-lg bg-muted border border-border" />
              ))}
            </div>

            {/* Outfit Cards based on selected item */}
            <div className="grid grid-cols-2 gap-3">
              {renderOutfitCard(anchorOutfits[0] || null, 0, 'anchor')}
              {renderOutfitCard(anchorOutfits[1] || null, 1, 'anchor')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WardrobeOutfitSuggestion;
