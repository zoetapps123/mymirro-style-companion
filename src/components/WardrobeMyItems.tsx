import { useState, useEffect, useRef } from "react";
import { Plus, DoorOpen, Sparkles, Calendar, Shirt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { LoadingTile } from "@/components/ui/loading-tile";
import { useWardrobeItems } from "@/hooks/useWardrobeItems";
import emptyWardrobeImg from "@/assets/empty-wardrobe.png";
// Image processing imported dynamically when needed

interface WardrobeMyItemsProps {
  onNavigate: (view: 'items' | 'suggestion' | 'calendar' | 'lookbook') => void;
}

const WardrobeMyItems = ({ onNavigate }: WardrobeMyItemsProps) => {
  const { items, isLoading, invalidateItems } = useWardrobeItems();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [processingItems, setProcessingItems] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const features = [
    { icon: DoorOpen, title: "Your\nCloset", view: 'items' as const, active: true },
    { icon: Sparkles, title: "Outfits", view: 'suggestion' as const, active: false },
    { icon: Calendar, title: "Plan Your\nLook", view: 'calendar' as const, active: false },
    { icon: Shirt, title: "Your\nLookbook", view: 'lookbook' as const, active: false },
  ];

  useEffect(() => {
    // Check for items being processed from onboarding or other sources
    const checkProcessingCount = () => {
      const stored = localStorage.getItem('wardrobe_processing_count');
      if (stored) {
        const count = parseInt(stored);
        if (count > 0) {
          setProcessingItems(count);
        }
      }
    };
    
    checkProcessingCount();
    
    // Poll for processing updates
    const pollInterval = setInterval(() => {
      checkProcessingCount();
      invalidateItems(); // Refetch items if processing count changes
    }, 2000);
    
    return () => clearInterval(pollInterval);
  }, [invalidateItems]);

  const handleDelete = async (itemId: string, itemName: string) => {
    try {
      const { error } = await supabase
        .from('wardrobe_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Item removed",
        description: `${itemName} has been removed from your wardrobe.`,
      });

      invalidateItems(); // Refresh cache after deletion
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to remove item.",
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert to array like onboarding does
    const fileArray = Array.from(files);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        throw new Error("Authentication required");
      }

      const user = session.user;

      // Show toast for batch upload
      toast({
        title: "Uploading photos",
        description: `Processing ${fileArray.length} photo${fileArray.length !== 1 ? 's' : ''}...`,
      });

      // Update processing count for ALL files immediately
      const currentCount = parseInt(localStorage.getItem('wardrobe_processing_count') || '0');
      localStorage.setItem('wardrobe_processing_count', (currentCount + fileArray.length).toString());
      setProcessingItems(prev => prev + fileArray.length);

      // Upload and process each file (same pattern as onboarding)
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        try {
          // Upload the original image first to get a public URL
          const ext = file.name.split('.').pop() || 'png';
          const sourceName = `${user.id}/wardrobe_src_${Date.now()}_${i}.${ext}`;
          
          const { error: srcUploadError } = await supabase.storage
            .from('outfits')
            .upload(sourceName, file);
            
          if (srcUploadError) throw srcUploadError;
          
          const { data: { publicUrl: sourceUrl } } = supabase.storage
            .from('outfits')
            .getPublicUrl(sourceName);

          // Process in background (non-blocking) - exactly like onboarding
          processImageInBackground(sourceUrl, user.id);
          
        } catch (error: any) {
          console.error('Error uploading file:', file.name, error);
          // Decrement on failure
          const currentCount = parseInt(localStorage.getItem('wardrobe_processing_count') || '0');
          localStorage.setItem('wardrobe_processing_count', Math.max(0, currentCount - 1).toString());
          setProcessingItems(prev => Math.max(0, prev - 1));
        }
      }

    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload images",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Background processing function - fire and forget like onboarding
  const processImageInBackground = (sourceUrl: string, userId: string) => {
    // Fire the request without awaiting - handle response when it comes back
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        console.error('No session for background processing');
        const currentCount = parseInt(localStorage.getItem('wardrobe_processing_count') || '0');
        localStorage.setItem('wardrobe_processing_count', Math.max(0, currentCount - 1).toString());
        setProcessingItems(prev => Math.max(0, prev - 1));
        return;
      }

      console.log('Calling Gemini-only pipeline...');
      
      // Fetch existing items for duplicate checking (include primary_color and brand)
      supabase
        .from('wardrobe_items')
        .select('name, category, color, primary_color, brand')
        .eq('user_id', userId)
        .then(({ data: existingItems }) => {
          
          // Fire and forget - don't await the edge function
          supabase.functions.invoke('process-wardrobe', {
            body: { imageUrl: sourceUrl },
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
          .then(async ({ data: processData, error: processError }) => {
            if (processError) {
              console.error("Background process error:", processError);
              return;
            }

            if (!processData?.items || processData.items.length === 0) {
              console.log('No items detected');
              return;
            }

            // Items now come with generated images from Gemini
            let addedCount = 0;
            const { isLikelyDuplicateWardrobeItem } = await import('@/lib/wardrobeDeduplication');
            
            const insertPromises = processData.items.map(async (item: any) => {
              // Check for duplicates using centralized logic
              let isDuplicate = false;
              let duplicateReason = '';
              
              if (existingItems && existingItems.length > 0) {
                for (const existing of existingItems) {
                  const result = isLikelyDuplicateWardrobeItem(existing, item);
                  if (result.isDuplicate) {
                    isDuplicate = true;
                    duplicateReason = result.reason || 'duplicate';
                    break;
                  }
                }
              }

              if (isDuplicate) {
                console.log(`Skipping duplicate: ${item.name} [${duplicateReason}]`);
                return;
              }

              // Item already has imageUrl from Gemini generation
              const { mapDetectedItemToDbRecord } = await import('@/lib/wardrobeItemMapper');
              const { data: insertedRows, error } = await supabase.from('wardrobe_items').insert([
                mapDetectedItemToDbRecord(item, userId, item.imageUrl, item.imageUrl)
              ]).select('*');

              addedCount++;
            });

            Promise.all(insertPromises).then(() => {
              if (addedCount > 0) {
                toast({
                  title: "Items added!",
                  description: `Added ${addedCount} item${addedCount !== 1 ? 's' : ''} to your wardrobe`,
                });
              }
              console.log(`Background processing complete: Added ${addedCount} items to wardrobe`);
            });
          })
          .catch((error) => {
            console.error("Background processing failed:", error);
          })
          .finally(() => {
            const currentCount = parseInt(localStorage.getItem('wardrobe_processing_count') || '0');
            localStorage.setItem('wardrobe_processing_count', Math.max(0, currentCount - 1).toString());
            setProcessingItems(prev => Math.max(0, prev - 1));
            invalidateItems(); // Refresh cache after adding items
          });
        });
    });
  };

  const normalizeCategory = (category: string) => {
    if (!category) return '';
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  };

  // Generate categories dynamically from wardrobe items
  const categories = (() => {
    if (!items || items.length === 0) return [];
    
    const uniqueCategories = new Set<string>();
    items.forEach(item => {
      if (item.category) {
        const normalized = normalizeCategory(item.category);
        uniqueCategories.add(normalized);
      }
    });
    
    const sortedCategories = Array.from(uniqueCategories).sort();
    return ["All", ...sortedCategories];
  })();

  const filteredItems = items.filter(item => {
    if (selectedCategory === "All") return true;
    return normalizeCategory(item.category) === selectedCategory;
  });

  // Show empty state if no items
  if (items.length === 0 && processingItems === 0) {
    return (
      <div className="flex flex-col h-full bg-background">
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

        {/* Empty State */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <img 
            src={emptyWardrobeImg} 
            alt="Empty wardrobe" 
            className="w-[122px] h-[123px] mb-[33px] object-contain mx-auto"
          />
          <h3 className="text-2xl font-bold text-primary mb-[16px] text-center">
            Your closet looks a little lonely
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-[22px] max-w-sm">
            Upload your clothes to unlock outfit ideas, styling and personalised suggestions.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-8 py-3 bg-primary/10 text-primary rounded-full font-medium hover:bg-primary/20 transition-colors"
          >
            Add Item +
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Feature Icons */}
      <div className="px-4 pt-6 pb-4">
        <div className="grid grid-cols-4 gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isActive = feature.active;
            return (
              <motion.button
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onNavigate(feature.view)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? "bg-primary border-2 border-primary shadow-lg"
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
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Title */}
      <div className="px-4 pb-3">
        <h2 className="text-3xl font-bold">My Items</h2>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {categories.map((category) => (
              <motion.div key={category} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full min-h-[36px] transition-all duration-300 ${
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "bg-transparent border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {category}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {/* Loading tiles */}
          {Array.from({ length: processingItems }).map((_, idx) => (
            <LoadingTile key={`loading-${idx}`} />
          ))}
          
          {/* Actual items */}
          {filteredItems.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-border/50 relative bg-background"
            >
              <img
                src={item.processed_image_url || item.image_url}
                alt={item.name}
                className="w-full h-full object-contain"
              />
              {/* Delete Button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleDelete(item.id, item.name)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/90 hover:bg-red-600 flex items-center justify-center shadow-lg z-10"
                aria-label="Delete item"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </motion.button>
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white text-sm font-medium truncate">
                  {item.name}
                </p>
                {item.color && (
                  <p className="text-white/80 text-xs">
                    {item.primary_color_name || item.color}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Floating Add Button */}
      <motion.button
        onClick={() => fileInputRef.current?.click()}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-24 right-6 w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-lg z-50"
      >
        <Plus className="w-8 h-8 text-white" />
      </motion.button>
    </div>
  );
};

export default WardrobeMyItems;
