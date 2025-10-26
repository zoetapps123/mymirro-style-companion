import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import OutfitDetailEditor from "./OutfitDetailEditor";

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  image_url: string;
  processed_image_url: string;
  color: string;
}

interface Outfit {
  id: string;
  items: WardrobeItem[];
  type: 'style' | 'occasion' | 'item';
  label: string;
}

interface AutoGenerateOutfitsProps {
  onBack: () => void;
}

const AutoGenerateOutfits = ({ onBack }: AutoGenerateOutfitsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [styleOutfits, setStyleOutfits] = useState<Outfit[]>([]);
  const [occasionOutfits, setOccasionOutfits] = useState<Outfit[]>([]);
  const [editingOutfit, setEditingOutfit] = useState<Outfit | null>(null);

  useEffect(() => {
    fetchWardrobeItems();
  }, []);

  useEffect(() => {
    if (wardrobeItems.length >= 6) {
      generateAllOutfits();
    }
  }, [wardrobeItems]);

  const fetchWardrobeItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('wardrobe_items')
      .select('*');
    setWardrobeItems(data || []);
    setLoading(false);
  };

  const generateAllOutfits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-generate-outfits', {
        body: { items: wardrobeItems }
      });

      if (error) throw error;

      setStyleOutfits(data.styleOutfits || []);
      setOccasionOutfits(data.occasionOutfits || []);
    } catch (error) {
      console.error('Error generating outfits:', error);
      toast({
        title: "Error",
        description: "Failed to auto-generate outfits.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const renderOutfitTemplate = (outfit: Outfit) => (
    <div 
      className="bg-white rounded-xl p-4 cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => setEditingOutfit(outfit)}
    >
      <div className="grid grid-cols-2 gap-2">
        {outfit.items.slice(0, 4).map((item, idx) => (
          <div key={idx} className="aspect-square bg-gray-50 rounded-lg overflow-hidden">
            <img
              src={item.processed_image_url}
              alt={item.name}
              className="w-full h-full object-contain"
            />
          </div>
        ))}
      </div>
      <p className="text-sm font-medium mt-2 text-center text-foreground">{outfit.label}</p>
    </div>
  );

  if (editingOutfit) {
    return (
      <OutfitDetailEditor
        outfit={editingOutfit}
        wardrobeItems={wardrobeItems}
        onBack={() => setEditingOutfit(null)}
        onSave={() => {
          setEditingOutfit(null);
          toast({ title: "Outfit saved!", description: "Your outfit is now in your collection." });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-6 overflow-y-auto">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Auto-Generate Outfits</h2>
        <p className="text-sm text-muted-foreground">
          Smart outfit combinations created just for you
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Sparkles className="w-12 h-12 animate-pulse text-primary" />
        </div>
      ) : (
        <>
          {/* Style-based Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">By Style</h3>
            <Carousel className="w-full">
              <CarouselContent>
                {styleOutfits.map((outfit) => (
                  <CarouselItem key={outfit.id} className="basis-1/2 md:basis-1/3">
                    {renderOutfitTemplate(outfit)}
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>

          {/* Occasion-based Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">By Occasion</h3>
            <Carousel className="w-full">
              <CarouselContent>
                {occasionOutfits.map((outfit) => (
                  <CarouselItem key={outfit.id} className="basis-1/2 md:basis-1/3">
                    {renderOutfitTemplate(outfit)}
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>
        </>
      )}
    </div>
  );
};

export default AutoGenerateOutfits;
