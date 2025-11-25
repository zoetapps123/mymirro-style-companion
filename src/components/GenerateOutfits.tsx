import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, Camera, Loader2, Shirt, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent } from "@/lib/mixpanel";
import { useWardrobeItems } from "@/hooks/useWardrobeItems";
import { WardrobeLoadingSkeleton } from "@/components/ui/wardrobe-loading-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  image_url: string;
  processed_image_url: string;
  color: string;
}

interface GenerateOutfitsProps {
  selectedItem: WardrobeItem | null;
  onBack: () => void;
  onTryAnother: () => void;
}

const occasions = [
  "Casual Day Out",
  "Office",
  "Dinner Date",
  "Party",
  "Wedding",
  "Travel",
  "Interview"
];

const GenerateOutfits = ({ selectedItem, onBack, onTryAnother }: GenerateOutfitsProps) => {
  const { toast } = useToast();
  const { trackCustom, startFlow, trackFlowStep, completeFlow } = useAnalytics();
  const [selectedOccasion, setSelectedOccasion] = useState("");
  const [loading, setLoading] = useState(false);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const { items: wardrobeItems, isLoading: isLoadingWardrobe } = useWardrobeItems();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [outfitName, setOutfitName] = useState("");
  const [aiGenerationCount, setAiGenerationCount] = useState(0);

  useEffect(() => {
    if (!selectedItem) {
      onTryAnother();
    }
  }, [selectedItem, onTryAnother]);

  const generateOutfit = async () => {
    if (!selectedOccasion) {
      toast({
        title: "Select an occasion",
        description: "Please choose an occasion to generate outfits.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedItem) {
      toast({
        title: "No item selected",
        description: "Please select an item from your wardrobe first.",
        variant: "destructive"
      });
      return;
    }

    const flowId = startFlow('outfit_generation', {
      occasion: selectedOccasion,
      selected_item_id: selectedItem.id,
    });
    
    trackFlowStep('outfit_generation', 'occasion_selected', { occasion: selectedOccasion });
    trackFlowStep('outfit_generation', 'generating');
    
    // Track outfit generation submit
    trackCustom('outfit_generation_submit', {
      occasion: selectedOccasion,
      selected_item_id: selectedItem.id,
      selected_item_category: selectedItem.category,
      wardrobe_item_count: wardrobeItems.length,
      flow_id: flowId,
    }, `Generate Outfits - Submit (${selectedOccasion})`);
    
    // Mixpanel: Track generation started
    trackEvent('outfit_generation_started', {
      occasion: selectedOccasion,
      selected_item_category: selectedItem.category,
      wardrobe_item_count: wardrobeItems.length
    });

    setLoading(true);
    const generationStartTime = Date.now();

    try {
      console.log('Calling generate-outfit with:', {
        occasion: selectedOccasion,
        selectedItemId: selectedItem.id,
        itemCount: wardrobeItems.length
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase.functions.invoke('generate-outfit', {
        body: {
          occasion: selectedOccasion,
          selectedItem: selectedItem,
          weatherContext: "Comfortable",
          userItems: wardrobeItems
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) {
        console.error('Generate outfit error:', error);
        throw error;
      }

      console.log('Generated outfit:', data);
      
      // Check if outfit has AI suggestions
      const hasAiSuggestions = Object.values(data.outfit).some(
        (item: any) => item && !item.useExisting
      );
      
      if (hasAiSuggestions) {
        setAiGenerationCount(prev => prev + 1);
      }

      setOutfits(prev => [...prev, data]);
      setCurrentOutfitIndex(outfits.length);
      
      const generationDuration = Date.now() - generationStartTime;
      const durationSeconds = Math.floor(generationDuration / 1000);
      
      completeFlow('outfit_generation', true, {
        occasion: selectedOccasion,
        has_ai_suggestions: hasAiSuggestions,
        outfit_item_count: Object.keys(data.outfit || {}).length,
        duration_ms: generationDuration,
      });
      
      trackCustom('outfit_generated', {
        occasion: selectedOccasion,
        base_item: selectedItem.name,
        duration_seconds: durationSeconds
      }, 'user_action:generate_outfit');

      // Track successful generation
      trackCustom('outfit_generation_completed', {
        occasion: selectedOccasion,
        has_ai_suggestions: hasAiSuggestions,
        outfit_item_count: Object.keys(data.outfit || {}).length,
        duration_ms: generationDuration,
      }, `Generate Outfits - Completed (${selectedOccasion})`);
      
      // Mixpanel: Track outfit generated
      trackEvent('outfit_generated', {
        occasion: selectedOccasion,
        has_ai_suggestions: hasAiSuggestions,
        outfit_item_count: Object.keys(data.outfit || {}).length,
        duration_seconds: durationSeconds
      });
      
      // Mixpanel: Track generation completed
      trackEvent('outfit_generation_completed', {
        occasion: selectedOccasion,
        has_ai_suggestions: hasAiSuggestions,
        outfit_item_count: Object.keys(data.outfit || {}).length,
        duration_seconds: durationSeconds
      });

      toast({
        title: "Outfit generated!",
        description: data.reasoning,
      });

      // After 3 AI generations, prompt to upload items
      if (aiGenerationCount >= 2 && hasAiSuggestions) {
        setTimeout(() => {
          toast({
            title: "Complete your wardrobe",
            description: "Upload the missing items to get even better outfit suggestions!",
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Error generating outfit:', error);
      
      completeFlow('outfit_generation', false, {
        occasion: selectedOccasion,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - generationStartTime,
      });
      
      // Track error
      trackCustom('outfit_generation_error', {
        occasion: selectedOccasion,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }, 'Generate Outfits - Error');
      
      // Mixpanel: Track generation error
      trackEvent('outfit_generation_failed', {
        occasion: selectedOccasion,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        duration_seconds: Math.floor((Date.now() - generationStartTime) / 1000)
      });

      toast({
        title: "Error",
        description: "Failed to generate outfit. Try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveOutfit = async () => {
    if (!currentOutfit || !outfitName.trim()) return;

    // Track save intent
    trackCustom('outfit_save_clicked', {
      outfit_name: outfitName,
      occasion: selectedOccasion,
      item_count: Object.keys(currentOutfit.outfit || {}).length
    }, 'generate_outfits:save_outfit');
    
    // Mixpanel: Track save clicked
    trackEvent('outfit_save_clicked', {
      occasion: selectedOccasion,
      item_count: Object.keys(currentOutfit.outfit || {}).length
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: savedOutfit, error: outfitError } = await supabase
        .from('outfits')
        .insert({
          user_id: user.id,
          name: outfitName,
          occasion: selectedOccasion
        })
        .select()
        .single();

      if (outfitError) throw outfitError;

      const outfitItems = Object.entries(currentOutfit.outfit)
        .filter(([_, item]: any) => item)
        .map(([type, item]: any) => ({
          outfit_id: savedOutfit.id,
          item_id: item.useExisting ? item.itemId : null,
          ai_virtual: !item.useExisting,
          ai_meta: !item.useExisting ? { suggestion: item.aiSuggestion } : null,
          item_type: type
        }));

      const { error: itemsError } = await supabase
        .from('outfit_items')
        .insert(outfitItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Outfit saved!",
        description: `"${outfitName}" is ready in your collection.`,
      });
      
      // Mixpanel: Track look saved
      trackEvent('look_saved', {
        outfit_name: outfitName,
        occasion: selectedOccasion,
        item_count: Object.keys(currentOutfit.outfit || {}).length
      });

      setShowSaveDialog(false);
      setOutfitName("");
    } catch (error) {
      console.error('Error saving outfit:', error);
      toast({
        title: "Error",
        description: "Failed to save outfit.",
        variant: "destructive",
      });
    }
  };

  const currentOutfit = outfits[currentOutfitIndex];

  // Show loading skeleton while fetching wardrobe items
  if (isLoadingWardrobe) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="p-4">
            <WardrobeLoadingSkeleton message="Loading wardrobe items..." itemCount={6} />
          </div>
        </div>
      </div>
    );
  }

  const navigateOutfit = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentOutfitIndex > 0) {
      setCurrentOutfitIndex(prev => prev - 1);
    } else if (direction === 'next' && currentOutfitIndex < outfits.length - 1) {
      setCurrentOutfitIndex(prev => prev - 1);
    }
  };

  const renderOutfitItem = (type: string, item: any) => {
    if (!item) return null;

    const wardrobeItem = item.useExisting 
      ? wardrobeItems.find(w => w.id === item.itemId)
      : null;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-4 rounded-xl space-y-3"
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium capitalize">{type}</h4>
          {!item.useExisting && (
            <Badge variant="secondary" className="text-xs">AI Suggestion</Badge>
          )}
        </div>
        
        <div className="aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden">
          {wardrobeItem?.processed_image_url ? (
            <img 
              src={wardrobeItem.processed_image_url} 
              alt={wardrobeItem.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <Shirt className="w-12 h-12 text-muted-foreground" />
          )}
        </div>

        <div>
          <p className="text-sm font-medium">
            {item.useExisting ? item.itemName : item.aiSuggestion}
          </p>
          {!item.useExisting && (
            <p className="text-xs text-muted-foreground mt-1">
              Complete the look with this piece
            </p>
          )}
        </div>
      </motion.div>
    );
  };

  if (!selectedItem) {
    return null;
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Generate Outfits</h2>
        <p className="text-sm text-muted-foreground">
          Build complete looks around your selected item
        </p>
      </div>

      {/* Selected Item */}
      <div className="glass-card p-4 rounded-xl">
        <p className="text-sm font-medium mb-2">Selected Item</p>
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center overflow-hidden">
            <img
              src={selectedItem.processed_image_url}
              alt={selectedItem.name}
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <p className="font-medium">{selectedItem.name}</p>
            <p className="text-xs text-muted-foreground">{selectedItem.category}</p>
          </div>
        </div>
      </div>

      {/* Occasion Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Occasion *</label>
        <div className="flex flex-wrap gap-2">
          {occasions.map(occasion => (
            <Badge
              key={occasion}
              variant={selectedOccasion === occasion ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedOccasion(occasion)}
            >
              {occasion}
            </Badge>
          ))}
        </div>
      </div>

      {/* Outfit Canvas */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-full"
            >
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">Creating your perfect look...</p>
              </div>
            </motion.div>
          ) : currentOutfit ? (
            <motion.div
              key={`outfit-${currentOutfitIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Here's a clean balanced look for your event. Wanna see how it looks on you? Hit Try On!
                </p>
                {outfits.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateOutfit('prev')}
                      disabled={currentOutfitIndex === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {currentOutfitIndex + 1} / {outfits.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateOutfit('next')}
                      disabled={currentOutfitIndex === outfits.length - 1}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {renderOutfitItem('top', currentOutfit.outfit.top)}
                {renderOutfitItem('bottom', currentOutfit.outfit.bottom)}
                {renderOutfitItem('layer', currentOutfit.outfit.layer)}
                {renderOutfitItem('shoes', currentOutfit.outfit.shoes)}
                {renderOutfitItem('accessories', currentOutfit.outfit.accessories)}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-full"
            >
              <div className="text-center space-y-4">
                <Sparkles className="w-16 h-16 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Select an occasion and generate your first look!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
      <Button
        variant="outline"
        disabled={loading}
        className="group relative hover:scale-105 transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20"
        onClick={(e) => {
          trackCustom('outfit_generation_try_another', {
            previous_outfit_count: outfits.length,
            occasion: selectedOccasion
          }, 'generate_outfits:try_another');
          
          // Mixpanel: Track try another clicked
          trackEvent('outfit_generation_try_another', {
            previous_outfit_count: outfits.length,
            occasion: selectedOccasion
          });
          
          onTryAnother();
        }}
      >
          <RefreshCw className="w-4 h-4 mr-2 transition-transform duration-500 group-hover:rotate-180" />
          Try Another Item
          <div className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/10 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={generateOutfit}
          disabled={loading || !selectedOccasion}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Generate New
        </Button>
        {currentOutfit && (
          <>
            <Button
              variant="secondary"
              onClick={() => setShowSaveDialog(true)}
              disabled={loading}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button 
              variant="secondary"
              disabled={loading}
              onClick={() => toast({
                title: "Try On coming soon!",
                description: "Upload a clear photo in good light, bro/girl — trust me, your fit deserves it :P"
              })}
            >
              <Camera className="w-4 h-4 mr-2" />
              Try On
            </Button>
          </>
        )}
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Outfit</DialogTitle>
            <DialogDescription>
              Give your outfit a name to save it to your collection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={`${selectedOccasion} Look #1`}
              value={outfitName}
              onChange={(e) => setOutfitName(e.target.value)}
            />
            <Button onClick={saveOutfit} className="w-full" disabled={!outfitName.trim()}>
              Save Outfit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GenerateOutfits;
