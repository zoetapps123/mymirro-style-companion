import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Heart, Loader2, Sparkles, Shirt, Calendar, Palette, DoorOpen } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import useEmblaCarousel from 'embla-carousel-react';
import { OutfitDetailView } from './OutfitDetailView';
import { OutfitLoadingTile } from '@/components/ui/loading-tile';
import { motion } from 'framer-motion';

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  color: string;
  fabric?: string;
  pattern?: string;
  style_notes?: string;
  processed_image_url?: string;
  image_url: string;
}

interface GeneratedOutfit {
  id?: string;
  name: string;
  occasion?: string;
  style_tag?: string;
  preview_image_url?: string;
  items: WardrobeItem[];
  reasoning?: string;
}

interface WardrobeOutfitSuggestionProps {
  onBack: () => void;
  onNavigate: (view: 'items' | 'suggestion' | 'calendar' | 'lookbook') => void;
}

const OCCASIONS = ['Wedding', 'Casual', 'Date Night', 'Office', 'Party'];
const STYLES = ['Minimalist', 'Boho', 'Streetwear', 'Elegant', 'Sporty'];

const WardrobeOutfitSuggestion = ({ onBack, onNavigate }: WardrobeOutfitSuggestionProps) => {
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedAnchorItem, setSelectedAnchorItem] = useState<WardrobeItem | null>(null);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [occasionOutfits, setOccasionOutfits] = useState<Record<string, GeneratedOutfit[]>>({});
  const [styleOutfits, setStyleOutfits] = useState<Record<string, GeneratedOutfit[]>>({});
  const [anchorOutfits, setAnchorOutfits] = useState<GeneratedOutfit[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [hasNewItems, setHasNewItems] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState<GeneratedOutfit | null>(null);
  const [userLocation, setUserLocation] = useState<{ temp: number; weather: string; lat: number } | null>(null);
  const [isLoadingOutfits, setIsLoadingOutfits] = useState(true);

  const features = [
    { icon: DoorOpen, title: "Your\nCloset", view: 'items' as const, active: false },
    { icon: Sparkles, title: "Outfit\nSuggestion", view: 'suggestion' as const, active: true },
    { icon: Calendar, title: "Plan Your\nLook", view: 'calendar' as const, active: false },
    { icon: Shirt, title: "Your\nLookbook", view: 'lookbook' as const, active: false },
  ];

  useEffect(() => {
    const initializeData = async () => {
      setIsLoadingOutfits(true);
      await fetchWardrobeItems();
      await checkForNewItems();
      await loadExistingOutfits();
      await getUserLocation();
      setIsLoadingOutfits(false);
    };
    initializeData();
  }, []);

  const checkForNewItems = async () => {
    const lastGen = localStorage.getItem('last_outfit_generation');
    if (!lastGen) {
      setHasNewItems(true);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: items } = await supabase
      .from('wardrobe_items')
      .select('created_at')
      .eq('user_id', user.id)
      .gt('created_at', lastGen);

    setHasNewItems((items?.length || 0) > 0);
  };

  const getUserLocation = async () => {
    try {
      // Try to get from localStorage first
      const savedLocation = localStorage.getItem('user_location');
      if (savedLocation) {
        const parsed = JSON.parse(savedLocation);
        const ageInHours = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
        if (ageInHours < 6) {
          setUserLocation(parsed.data);
          return;
        }
      }

      // For now, use a default moderate temperature if location not available
      // In production, this would integrate with a weather API
      const defaultLocation = {
        temp: 20,
        weather: 'Clear',
        lat: 0
      };
      setUserLocation(defaultLocation);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadExistingOutfits = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: outfits } = await supabase
      .from('outfits')
      .select(`
        *,
        outfit_items (
          item_id,
          item_type,
          wardrobe_items (*)
        )
      `)
      .eq('user_id', user.id)
      .eq('saved_to_lookbook', false);

    if (!outfits || outfits.length === 0) return;

    // Group outfits by occasion/style with sensible fallbacks
    const byOccasion: Record<string, GeneratedOutfit[]> = {};
    const byStyle: Record<string, GeneratedOutfit[]> = {};
    const anchor: GeneratedOutfit[] = [];

    outfits.forEach(outfit => {
      const items = outfit.outfit_items?.map((oi: any) => oi.wardrobe_items).filter(Boolean) || [];
      const metadata = outfit.metadata as { type?: string; reasoning?: string } | null;
      const generatedOutfit: GeneratedOutfit = {
        id: outfit.id,
        name: outfit.name,
        occasion: outfit.occasion,
        style_tag: outfit.style_tag,
        preview_image_url: outfit.preview_image_url,
        items,
        reasoning: metadata?.reasoning
      };

      if (metadata?.type === 'occasion' && outfit.occasion) {
        (byOccasion[outfit.occasion] ||= []).push(generatedOutfit);
      } else if (metadata?.type === 'style' && outfit.style_tag) {
        (byStyle[outfit.style_tag] ||= []).push(generatedOutfit);
      } else if (metadata?.type === 'anchor') {
        anchor.push(generatedOutfit);
      } else {
        // Fallback grouping when metadata is missing
        if (outfit.occasion) {
          (byOccasion[outfit.occasion] ||= []).push(generatedOutfit);
        } else if (outfit.style_tag) {
          (byStyle[outfit.style_tag] ||= []).push(generatedOutfit);
        } else {
          anchor.push(generatedOutfit);
        }
      }
    });

    // Persist and restore last selections or pick first available
    const savedOcc = localStorage.getItem('last_selected_occasion');
    const savedStyle = localStorage.getItem('last_selected_style');

    const occKeys = Object.keys(byOccasion);
    const styleKeys = Object.keys(byStyle);

    const nextOcc = savedOcc && byOccasion[savedOcc]?.length ? savedOcc : (occKeys[0] || null);
    const nextStyle = savedStyle && byStyle[savedStyle]?.length ? savedStyle : (styleKeys[0] || null);

    setOccasionOutfits(byOccasion);
    setStyleOutfits(byStyle);
    setAnchorOutfits(anchor);

    if (!selectedOccasion && nextOcc) setSelectedOccasion(nextOcc);
    if (!selectedStyle && nextStyle) setSelectedStyle(nextStyle);
  };

  const fetchWardrobeItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('wardrobe_items')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to load wardrobe');
      return;
    }

    setWardrobeItems(data || []);
  };

  const generateOutfits = async (type: 'occasion' | 'style' | 'anchor', value: string, anchorItem?: WardrobeItem) => {
    const key = `${type}-${value}`;
    
    // Check if outfits already exist
    if (type === 'occasion' && occasionOutfits[value]?.length > 0) {
      console.log(`Outfits for ${value} already loaded from database`);
      return;
    }
    if (type === 'style' && styleOutfits[value]?.length > 0) {
      console.log(`Outfits for ${value} already loaded from database`);
      return;
    }
    if (type === 'anchor' && anchorOutfits.length > 0) {
      console.log('Anchor outfits already loaded');
      return;
    }

    setLoading(prev => ({ ...prev, [key]: true }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase.functions.invoke('generate-outfit', {
        body: {
          generationType: type,
          occasion: type === 'occasion' ? value : undefined,
          style: type === 'style' ? value : undefined,
          anchorItem: anchorItem,
          wardrobeItems,
          maxOutfits: 5,
          userLocation
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) throw error;

      const outfits = data.outfits || [];

      // Save outfits to database
      for (const outfit of outfits) {
        const { data: savedOutfit, error: saveError } = await supabase
          .from('outfits')
          .insert({
            user_id: user.id,
            name: outfit.name || `${value} Look`,
            occasion: type === 'occasion' ? value : outfit.occasion,
            style_tag: outfit.styleTag || value,
            preview_image_url: outfit.preview_image_url,
            saved_to_lookbook: false,
            metadata: { 
              type, 
              value, 
              reasoning: outfit.reasoning,
              anchorItemId: anchorItem?.id 
            }
          })
          .select()
          .single();

        if (saveError) {
          console.error('Failed to save outfit:', saveError);
          continue;
        }

        // Save outfit items
        const itemInserts = outfit.items.map((item: WardrobeItem) => ({
          outfit_id: savedOutfit.id,
          item_id: item.id,
          item_type: item.category,
          ai_virtual: false
        }));

        await supabase.from('outfit_items').insert(itemInserts);

        outfit.id = savedOutfit.id;
      }

      if (type === 'occasion') {
        setOccasionOutfits(prev => ({ ...prev, [value]: outfits }));
      } else if (type === 'style') {
        setStyleOutfits(prev => ({ ...prev, [value]: outfits }));
      } else {
        setAnchorOutfits(outfits);
      }

      toast.success(`Generated ${outfits.length} outfit${outfits.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate outfits');
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const regenerateAllOutfits = async () => {
    setLoading(prev => ({ ...prev, 'regenerate-all': true }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete all non-saved outfits
      await supabase
        .from('outfits')
        .delete()
        .eq('user_id', user.id)
        .eq('saved_to_lookbook', false);

      // Clear local state
      setOccasionOutfits({});
      setStyleOutfits({});
      setAnchorOutfits([]);

      toast.success('Creating fresh outfit suggestions');

      localStorage.setItem('last_outfit_generation', new Date().toISOString());
      setHasNewItems(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to regenerate outfits');
    } finally {
      setLoading(prev => ({ ...prev, 'regenerate-all': false }));
    }
  };

  const saveToLookbook = async (outfit: GeneratedOutfit) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: newOutfit, error: outfitError } = await supabase
        .from('outfits')
        .insert({
          user_id: user.id,
          name: outfit.name,
          occasion: outfit.occasion,
          style_tag: outfit.style_tag,
          preview_image_url: outfit.preview_image_url,
          saved_to_lookbook: true
        })
        .select()
        .single();

      if (outfitError) throw outfitError;

      const itemInserts = outfit.items.map(item => ({
        outfit_id: newOutfit.id,
        item_id: item.id,
        item_type: item.category,
        ai_virtual: false
      }));

      const { error: itemsError } = await supabase
        .from('outfit_items')
        .insert(itemInserts);

      if (itemsError) throw itemsError;

      toast.success('Outfit added to your lookbook');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save outfit');
    }
  };

  const OutfitCarousel = ({ outfits, sectionKey }: { outfits: GeneratedOutfit[], sectionKey: string }) => {
    const [emblaRef] = useEmblaCarousel({ loop: false, align: 'start' });
    const isLoading = loading[sectionKey];

    return (
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4">
          {/* Loading tiles */}
          {isLoading && Array.from({ length: 3 }).map((_, idx) => (
            <div key={`loading-${idx}`} className="flex-shrink-0 w-[280px]">
              <OutfitLoadingTile />
            </div>
          ))}
          
          {/* Actual outfits */}
          {!isLoading && outfits.map((outfit, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="flex-shrink-0 w-[280px] cursor-pointer"
              onClick={() => setSelectedOutfit(outfit)}
            >
              <div className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative aspect-square bg-white p-4 flex items-center justify-center">
                  <div className="grid grid-cols-2 gap-2 w-full h-full max-h-[240px]">
                    {outfit.items.slice(0, 4).map((item, i) => (
                      <div key={i} className="flex items-center justify-center bg-white overflow-hidden">
                        <img
                          src={item.processed_image_url || item.image_url}
                          alt={item.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 bg-card">
                  <h4 className="font-semibold mb-3 truncate text-sm">{outfit.style_tag || outfit.name}</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      saveToLookbook(outfit);
                    }}
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Save to Lookbook
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  if (selectedOutfit) {
    return (
      <OutfitDetailView
        outfit={selectedOutfit}
        onBack={() => setSelectedOutfit(null)}
        onSave={(saved) => {
          setSelectedOutfit(null);
          toast.success('Saved to lookbook!');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      {/* Feature Icons */}
      <div className="px-4 pt-6 pb-4">
        <div className="grid grid-cols-4 gap-4">
          {features.map((feature) => {
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

      {/* Main Content */}
      <div className="flex-1 p-6 space-y-8">
        {/* Regenerate Button */}
        {hasNewItems && (
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">New items detected!</h3>
              <p className="text-sm text-muted-foreground">Regenerate outfits with your latest pieces</p>
            </div>
            <Button
              onClick={regenerateAllOutfits}
              disabled={loading['regenerate-all']}
              className="gap-2"
            >
              {loading['regenerate-all'] ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Regenerate
            </Button>
          </div>
        )}

        {/* By Occasion */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-primary">
            <Calendar className="w-6 h-6" />
            By Occasion
          </h2>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {OCCASIONS.map(occasion => (
              <Button
                key={occasion}
                variant={selectedOccasion === occasion ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedOccasion(occasion);
                  localStorage.setItem('last_selected_occasion', occasion);
                  if (!occasionOutfits[occasion] || occasionOutfits[occasion].length === 0) {
                    generateOutfits('occasion', occasion);
                  }
                }}
                disabled={loading[`occasion-${occasion}`]}
                className="rounded-full"
              >
                {loading[`occasion-${occasion}`] && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {occasion}
              </Button>
            ))}
          </div>
          {selectedOccasion && (
            <OutfitCarousel
              outfits={occasionOutfits[selectedOccasion] || []}
              sectionKey={`occasion-${selectedOccasion}`}
            />
          )}
        </section>

        {/* By Style */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-primary">
            <Palette className="w-6 h-6" />
            By Style
          </h2>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {STYLES.map(style => (
              <Button
                key={style}
                variant={selectedStyle === style ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedStyle(style);
                  localStorage.setItem('last_selected_style', style);
                  if (!styleOutfits[style] || styleOutfits[style].length === 0) {
                    generateOutfits('style', style);
                  }
                }}
                disabled={loading[`style-${style}`]}
                className="rounded-full"
              >
                {loading[`style-${style}`] && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {style}
              </Button>
            ))}
          </div>
          {selectedStyle && (
            <OutfitCarousel
              outfits={styleOutfits[selectedStyle] || []}
              sectionKey={`style-${selectedStyle}`}
            />
          )}
        </section>

        {/* From My Items */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-primary">
            <Shirt className="w-6 h-6" />
            From My Items
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Select a top or bottom to build outfits around
          </p>
          <div className="flex gap-4 overflow-x-auto pb-4 mb-4">
            {wardrobeItems
              .filter(item => ['Tops', 'Bottoms'].includes(item.category))
              .slice(0, 10)
              .map(item => (
                <div
                  key={item.id}
                  className={`flex-shrink-0 w-24 cursor-pointer ${
                    selectedAnchorItem?.id === item.id ? 'ring-2 ring-primary rounded-lg' : ''
                  }`}
                  onClick={() => {
                    setSelectedAnchorItem(item);
                    generateOutfits('anchor', item.id, item);
                  }}
                >
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-2">
                    <img
                      src={item.processed_image_url || item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs text-center truncate">{item.name}</p>
                </div>
              ))}
          </div>
          {selectedAnchorItem && (
            <OutfitCarousel
              outfits={anchorOutfits}
              sectionKey="anchor"
            />
          )}
        </section>
      </div>
    </div>
  );
};

export default WardrobeOutfitSuggestion;
