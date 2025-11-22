import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, ArrowLeft, Loader2, X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateOutfitComposite, dataUrlToBlob } from '@/lib/outfitImageGenerator';
import { useAnalytics } from '@/hooks/useAnalytics';

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  color?: string;
  fabric?: string;
  pattern?: string;
  style_notes?: string;
  processed_image_url?: string;
  image_url: string;
}

interface Outfit {
  id?: string;
  name: string;
  occasion?: string;
  style_tag?: string;
  preview_image_url?: string;
  items: WardrobeItem[];
  reasoning?: string;
  saved_to_lookbook?: boolean;
}

interface OutfitDetailViewProps {
  outfit: Outfit;
  onBack: () => void;
  onSave: (outfit: Outfit) => void;
}

export const OutfitDetailView = ({ outfit, onBack, onSave }: OutfitDetailViewProps) => {
  const { toast } = useToast();
  const { trackCustom, trackScreenView } = useAnalytics();
  const [selectedItems, setSelectedItems] = useState<WardrobeItem[]>(outfit.items || []);
  const [recommendedItems, setRecommendedItems] = useState<WardrobeItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const [currentOutfitImage, setCurrentOutfitImage] = useState(outfit.preview_image_url);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState<WardrobeItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Track screen view on mount
  useEffect(() => {
    trackScreenView(
      'wardrobe-outfit-editor',
      { 
        outfit_id: outfit.id,
        outfit_name: outfit.name,
        items_count: outfit.items?.length || 0,
      },
      '/app/wardrobe/outfit-editor'
    );
  }, [trackScreenView]);

  useEffect(() => {
    loadRecommendedItems();
  }, []);

  useEffect(() => {
    // Generate image if not present
    if (!currentOutfitImage && selectedItems.length > 0 && !isRegenerating) {
      regenerateOutfitImage();
    }
  }, []);

  useEffect(() => {
    const originalIds = (outfit.items || []).map(i => i.id).sort().join(',');
    const currentIds = selectedItems.map(i => i.id).sort().join(',');
    setHasChanges(originalIds !== currentIds);
  }, [selectedItems, outfit.items]);

  const loadRecommendedItems = async () => {
    setIsLoadingRecommendations(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: allItems } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('user_id', user.id);

      if (!allItems) return;

      // Show ALL items (don't filter out items already in outfit)
      setRecommendedItems(allItems);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      setRecommendedItems([]);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const removeItem = (itemId: string) => {
    const item = selectedItems.find(i => i.id === itemId);
    if (!item) return;

    // Validate minimum items
    if (selectedItems.length === 1) {
      toast({
        title: "Cannot remove",
        description: "Outfit must have at least 1 item",
        variant: "destructive"
      });
      return;
    }

    const hasDress = selectedItems.some(i => i.category === 'Dresses');
    if (!hasDress && selectedItems.length === 2) {
      const hasTop = selectedItems.some(i => i.category === 'Tops');
      const hasBottom = selectedItems.some(i => i.category === 'Bottoms');
      if (hasTop && hasBottom && (item.category === 'Tops' || item.category === 'Bottoms')) {
        toast({
          title: "Cannot remove",
          description: "Outfit needs at least a top and bottom",
          variant: "destructive"
        });
        return;
      }
    }

    setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  };

  const addItem = (item: WardrobeItem, replaceCategory?: string) => {
    // If dropping on specific slot, replace that category
    if (replaceCategory) {
      setSelectedItems(prev => 
        prev.map(i => i.category === replaceCategory ? item : i)
      );
      toast({
        title: "Item replaced",
        description: `Replaced ${replaceCategory} with ${item.name}`
      });
      return;
    }

    // Check if item already in outfit
    if (selectedItems.some(i => i.id === item.id)) {
      toast({
        title: "Already in outfit",
        description: `${item.name} is already in this outfit`,
        variant: "destructive"
      });
      return;
    }

    const hasItemInCategory = selectedItems.some(i => i.category === item.category);
    
    if (hasItemInCategory) {
      setSelectedItems(prev => 
        prev.map(i => i.category === item.category ? item : i)
      );
      toast({
        title: "Item replaced",
        description: `Replaced ${item.category} with ${item.name}`
      });
    } else {
      setSelectedItems(prev => [...prev, item]);
      toast({
        title: "Item added",
        description: `Added ${item.name} to outfit`
      });
    }
  };

  const handleDragStart = (e: React.DragEvent, item: WardrobeItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, itemId?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (itemId) {
      setDropTarget(itemId);
    }
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent, targetItem?: WardrobeItem) => {
    e.preventDefault();
    if (!draggedItem) return;

    if (targetItem) {
      // Replace the target item
      addItem(draggedItem, targetItem.category);
    } else {
      // Add to outfit
      addItem(draggedItem);
    }

    setDraggedItem(null);
    setDropTarget(null);
  };

  const regenerateOutfitImage = async () => {
    setIsRegenerating(true);
    try {
      // Generate composite image from wardrobe items
      const compositeDataUrl = await generateOutfitComposite(selectedItems);
      
      // Convert to blob
      const blob = dataUrlToBlob(compositeDataUrl);
      const fileName = `outfit-${Date.now()}.png`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('outfits')
        .upload(fileName, blob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('outfits')
        .getPublicUrl(fileName);

      setCurrentOutfitImage(publicUrl);
      setHasChanges(false);

      toast({
        title: "Success",
        description: "Outfit image created!"
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to create outfit image",
        variant: "destructive"
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const saveToLookbook = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log('Saving outfit to lookbook...', { outfit, selectedItems });

      // If outfit already exists, update it
      if (outfit.id) {
        const { error: updateError } = await supabase
          .from('outfits')
          .update({
            saved_to_lookbook: true,
            preview_image_url: currentOutfitImage
          })
          .eq('id', outfit.id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }

        // Track outfit saved to lookbook
        trackCustom('outfit_saved_to_lookbook', {
          outfit_id: outfit.id,
          outfit_name: outfit.name,
          occasion: outfit.occasion,
          item_count: selectedItems.length,
        }, 'Outfit Detail - Saved to Lookbook');

        toast({
          title: "Saved!",
          description: "Outfit added to your lookbook"
        });

        onSave({ ...outfit, items: selectedItems, saved_to_lookbook: true });
        return;
      }

      // Create new outfit
      const { data: newOutfit, error: outfitError } = await supabase
        .from('outfits')
        .insert({
          user_id: user.id,
          name: outfit.name,
          occasion: outfit.occasion,
          style_tag: outfit.style_tag,
          preview_image_url: currentOutfitImage,
          saved_to_lookbook: true
        })
        .select()
        .single();

      if (outfitError) {
        console.error('Outfit insert error:', outfitError);
        throw outfitError;
      }

      const itemInserts = selectedItems.map(item => ({
        outfit_id: newOutfit.id,
        item_id: item.id,
        item_type: item.category,
        ai_virtual: false
      }));

      const { error: itemsError } = await supabase
        .from('outfit_items')
        .insert(itemInserts);

      if (itemsError) {
        console.error('Items insert error:', itemsError);
        throw itemsError;
      }

      toast({
        title: "Saved!",
        description: "Outfit added to your lookbook"
      });

      onSave({ ...newOutfit, items: selectedItems });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save outfit",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Outfit Suggestions
        </Button>
        <Button onClick={saveToLookbook} disabled={isSaving}>
          <Heart className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Outfit Preview */}
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-4">
            {isRegenerating ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="animate-spin h-12 w-12 mx-auto mb-4" />
                  <p className="text-muted-foreground">Creating outfit image...</p>
                </div>
              </div>
            ) : currentOutfitImage ? (
              <img src={currentOutfitImage} alt={outfit.name} className="w-full h-full object-contain" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No preview available
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold mb-2">{outfit.name}</h2>
          <p className="text-muted-foreground mb-4">{outfit.style_tag}</p>

          {hasChanges && !isRegenerating && (
            <Button onClick={regenerateOutfitImage} className="w-full mb-6">
              🔄 Update Outfit Image
            </Button>
          )}
        </div>

        {/* Items in Outfit */}
        <section className="max-w-4xl mx-auto mb-8">
          <h3 className="text-lg font-semibold mb-4">Items in this outfit</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {selectedItems.map(item => (
              <div 
                key={item.id} 
                className={`relative group ${dropTarget === item.id ? 'ring-2 ring-primary' : ''}`}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, item)}
              >
                <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                  <img 
                    src={item.processed_image_url || item.image_url} 
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeItem(item.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <p className="text-sm mt-2 text-center">{item.category}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recommended Items */}
        <section className="max-w-4xl mx-auto">
          <h3 className="text-lg font-semibold mb-4">Add items from your wardrobe</h3>
          <p className="text-sm text-muted-foreground mb-4">Drag items to replace existing pieces or click to add/replace</p>
          {isLoadingRecommendations ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8" />
            </div>
          ) : (
            <div className="space-y-6">
              {['Tops', 'Bottoms', 'Footwear', 'Dresses', 'Outerwear', 'Accessories'].map(category => {
                const categoryItems = recommendedItems.filter(item => item.category === category);
                if (categoryItems.length === 0) return null;
                
                return (
                  <div key={category}>
                    <h4 className="text-sm font-medium mb-3 text-muted-foreground">{category}</h4>
                    <div className="overflow-x-auto">
                      <div className="flex gap-4 pb-4">
                        {categoryItems.map(item => {
                          const isInOutfit = selectedItems.some(i => i.id === item.id);
                          return (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, item)}
                              onDragEnd={handleDragEnd}
                              className={`flex-shrink-0 w-32 cursor-move hover:opacity-80 transition-all ${
                                draggedItem?.id === item.id ? 'opacity-50' : ''
                              } ${isInOutfit ? 'ring-2 ring-primary' : ''}`}
                              onClick={() => addItem(item)}
                            >
                              <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-2 relative">
                                <img 
                                  src={item.processed_image_url || item.image_url}
                                  loading="lazy"
                                  decoding="async"
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                                {isInOutfit && (
                                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <div className="bg-primary text-primary-foreground rounded-full p-1">
                                      <Plus className="h-4 w-4" />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-center truncate">{item.name}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
