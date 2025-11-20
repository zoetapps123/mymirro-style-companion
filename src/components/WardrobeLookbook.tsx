import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, Shirt, Calendar, Sparkles, Filter, DoorOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { orderOutfitForDisplay } from '@/lib/utils';
import lookbookEmptyImg from '@/assets/lookbook-empty.png';

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  color: string;
  processed_image_url?: string;
  image_url: string;
}

interface Outfit {
  id: string;
  name: string;
  occasion?: string;
  style_tag?: string;
  preview_image_url?: string;
  items?: WardrobeItem[];
}

interface WardrobeLookbookProps {
  onBack: () => void;
  onNavigate: (view: 'items' | 'suggestion' | 'calendar' | 'lookbook') => void;
}

const WardrobeLookbook = ({ onBack, onNavigate }: WardrobeLookbookProps) => {
  const { toast } = useToast();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('All');

  const features = [
    { icon: DoorOpen, title: "Your\nCloset", view: 'items' as const, active: false },
    { icon: Sparkles, title: "Outfits", view: 'suggestion' as const, active: false },
    { icon: Calendar, title: "Plan Your\nLook", view: 'calendar' as const, active: false },
    { icon: Shirt, title: "Your\nLookbook", view: 'lookbook' as const, active: true },
  ];

  useEffect(() => {
    fetchLookbookOutfits();
  }, []);

  const fetchLookbookOutfits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('outfits')
        .select(`
          id,
          name,
          occasion,
          style_tag,
          preview_image_url,
          outfit_items (
            wardrobe_items (*)
          )
        `)
        .eq('user_id', user.id)
        .eq('saved_to_lookbook', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to include items
      const transformedOutfits = (data || []).map(outfit => ({
        ...outfit,
        items: outfit.outfit_items?.map((oi: any) => oi.wardrobe_items).filter(Boolean) || []
      }));

      setOutfits(transformedOutfits);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to load lookbook',
        variant: 'destructive'
      });
    }
  };

  // Group outfits by occasion/style
  const groupedOutfits = useMemo(() => {
    const filtered = selectedFilter === 'All'
      ? outfits
      : outfits.filter(o => o.occasion === selectedFilter || o.style_tag === selectedFilter);

    return filtered.reduce((acc, outfit) => {
      const key = outfit.occasion || outfit.style_tag || 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(outfit);
      return acc;
    }, {} as Record<string, Outfit[]>);
  }, [outfits, selectedFilter]);

  // Get unique filters
  const filters = useMemo(() => {
    const uniqueOccasions = new Set(outfits.map(o => o.occasion).filter(Boolean));
    const uniqueStyles = new Set(outfits.map(o => o.style_tag).filter(Boolean));
    return ['All', ...Array.from(uniqueOccasions), ...Array.from(uniqueStyles)];
  }, [outfits]);

  const unsaveOutfit = async (outfitId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('outfits')
        .update({ saved_to_lookbook: false })
        .eq('id', outfitId);

      if (error) throw error;

      setOutfits(prev => prev.filter(o => o.id !== outfitId));
      toast({
        title: 'Removed from Lookbook',
        description: 'Outfit removed from your lookbook',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to remove outfit from lookbook',
        variant: 'destructive'
      });
    }
  };

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

      {/* Filters */}
      {Object.keys(groupedOutfits).length > 0 && (
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Filter by:</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {filters.map(filter => (
              <Button
                key={filter}
                variant={selectedFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFilter(filter)}
                className="rounded-full"
              >
                {filter}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 p-6 space-y-8">
        {Object.keys(groupedOutfits).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <img 
              src={lookbookEmptyImg} 
              alt="Empty lookbook" 
              className="w-[220px] h-auto object-contain mb-8"
            />
            <h3 className="text-2xl font-bold text-primary mb-3 text-center">
              No saved fits yet
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Save curated outfits and create lookbooks for trips, seasons or moods.
            </p>
          </div>
        ) : (
          Object.entries(groupedOutfits).map(([group, groupOutfits]) => (
            <section key={group}>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-primary">
                📍 {group}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {groupOutfits.map(outfit => (
                  <div
                    key={outfit.id}
                    className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  >
                    {outfit.preview_image_url ? (
                      <div className="aspect-square bg-muted relative">
                        <img
                          src={outfit.preview_image_url}
                          alt={outfit.style_tag || outfit.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain"
                        />
                        <button
                          onClick={(e) => unsaveOutfit(outfit.id, e)}
                          className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background transition-colors"
                        >
                          <Heart className="w-6 h-6 fill-primary text-primary" />
                        </button>
                      </div>
                    ) : (
                      <div className="aspect-square bg-white p-3 grid grid-cols-2 gap-2 relative">
                        {orderOutfitForDisplay(outfit.items || []).map((item, i) => (
                          <div key={i} className="flex items-center justify-center bg-white">
                            <img
                              src={item.processed_image_url || item.image_url}
                              alt={item.name}
                              loading="lazy"
                              decoding="async"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        ))}
                        <button
                          onClick={(e) => unsaveOutfit(outfit.id, e)}
                          className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background transition-colors"
                        >
                          <Heart className="w-6 h-6 fill-primary text-primary" />
                        </button>
                      </div>
                    )}
                    <div className="p-3">
                      <h4 className="font-semibold truncate">{outfit.name}</h4>
                      {outfit.style_tag && (
                        <p className="text-xs text-muted-foreground truncate">{outfit.style_tag}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default WardrobeLookbook;
