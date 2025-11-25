import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { useWardrobeItems, WardrobeItem } from "@/hooks/useWardrobeItems";
import { OutfitGridLoadingSkeleton } from "@/components/ui/outfit-loading-skeleton";
import { trackEvent } from "@/lib/mixpanel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import OutfitDetailEditor from "./OutfitDetailEditor";
import { orderOutfitForDisplay } from "@/lib/utils";

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
  const { items: wardrobeItems, isLoading: isLoadingWardrobe } = useWardrobeItems();
  const [styleOutfits, setStyleOutfits] = useState<Outfit[]>([]);
  const [occasionOutfits, setOccasionOutfits] = useState<Outfit[]>([]);
  const [editingOutfit, setEditingOutfit] = useState<Outfit | null>(null);

  useEffect(() => {
    if (wardrobeItems.length >= 6 && styleOutfits.length === 0 && occasionOutfits.length === 0) {
      const cachedStyleOutfits = localStorage.getItem('auto_generated_style_outfits');
      const cachedOccasionOutfits = localStorage.getItem('auto_generated_occasion_outfits');
      
      if (cachedStyleOutfits && cachedOccasionOutfits) {
        try {
          setStyleOutfits(JSON.parse(cachedStyleOutfits));
          setOccasionOutfits(JSON.parse(cachedOccasionOutfits));
          console.log('[AutoGenerate] Loaded outfits from cache');
        } catch (e) {
          console.error('[AutoGenerate] Failed to parse cached outfits', e);
          generateAllOutfits();
        }
      } else {
        console.log('[AutoGenerate] No cache found, generating outfits');
        generateAllOutfits();
      }
    }
  }, [wardrobeItems]);

  const generateAllOutfits = async () => {
    setLoading(true);
    const startTime = Date.now();
    
    // Track auto-generate started
    trackEvent('auto_generate_outfits_started', {
      wardrobe_item_count: wardrobeItems.length
    });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Please sign in", description: "Authentication required", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke('auto-generate-outfits', {
        body: { items: wardrobeItems },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) throw error;

      setStyleOutfits(data.styleOutfits || []);
      setOccasionOutfits(data.occasionOutfits || []);
      
      const duration = Date.now() - startTime;
      
      // Track successful generation
      trackEvent('auto_generate_outfits_completed', {
        wardrobe_item_count: wardrobeItems.length,
        style_outfit_count: (data.styleOutfits || []).length,
        occasion_outfit_count: (data.occasionOutfits || []).length,
        total_outfit_count: (data.styleOutfits || []).length + (data.occasionOutfits || []).length,
        duration_seconds: Math.floor(duration / 1000)
      });
      
      // Save to localStorage
      localStorage.setItem('auto_generated_style_outfits', JSON.stringify(data.styleOutfits || []));
      localStorage.setItem('auto_generated_occasion_outfits', JSON.stringify(data.occasionOutfits || []));
    } catch (error) {
      console.error('Error generating outfits:', error);
      
      // Track generation error
      trackEvent('auto_generate_outfits_failed', {
        wardrobe_item_count: wardrobeItems.length,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        duration_seconds: Math.floor((Date.now() - startTime) / 1000)
      });
      
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
      onClick={() => {
        console.log('[AutoGenerate] Outfit clicked:', outfit.label);
        trackEvent('auto_generated_outfit_selected', {
          outfit_type: outfit.type,
          outfit_label: outfit.label,
          item_count: outfit.items.length
        });
        console.log('[AutoGenerate] Track event called');
        setEditingOutfit(outfit);
      }}
    >
      <h4 className="text-base font-semibold text-center mb-3 text-black">{outfit.label}</h4>
      <div className="grid grid-cols-2 gap-2">
        {orderOutfitForDisplay(outfit.items).map((item, idx) => (
          <div key={idx} className="aspect-square bg-gray-50 rounded-lg overflow-hidden">
            <img
              src={item.processed_image_url || item.image_url}
              alt={item.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain"
            />
          </div>
        ))}
      </div>
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
          toast({
            title: "Outfit saved!",
            description: "Your outfit has been saved to your lookbook.",
          });
        }}
      />
    );
  }

  // Show loading skeleton while fetching wardrobe items
  if (isLoadingWardrobe) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="p-4">
            <OutfitGridLoadingSkeleton message="Preparing your wardrobe..." outfitCount={6} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-3 sm:p-4 space-y-4 sm:space-y-6 overflow-y-auto pb-safe">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-gradient-primary">Auto-Generate Outfits</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Smart outfit combinations created just for you
          </p>
        </div>
        {!loading && (styleOutfits.length > 0 || occasionOutfits.length > 0) && (
          <Button 
            onClick={() => {
              trackEvent('auto_generate_outfits_regenerate_clicked', {
                previous_style_count: styleOutfits.length,
                previous_occasion_count: occasionOutfits.length
              });
              generateAllOutfits();
            }}
            variant="outline"
            size="sm"
            className="gap-2 flex-shrink-0 min-h-[44px] text-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Regenerate</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Sparkles className="w-12 h-12 animate-pulse text-primary" />
        </div>
      ) : (
        <>
          {/* Style-based Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Select your Style</h3>
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
            <h3 className="text-lg font-semibold">Select your occasion</h3>
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
