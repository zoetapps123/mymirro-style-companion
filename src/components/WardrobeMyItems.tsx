import { useState, useEffect, useRef } from "react";
import { Plus, DoorOpen, Sparkles, Calendar, Shirt, Upload, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { cropCompositeImage } from "@/lib/imageProcessing";

interface WardrobeMyItemsProps {
  onNavigate: (view: 'items' | 'suggestion' | 'calendar' | 'lookbook') => void;
}

interface ProcessingItem {
  id: string;
  status: 'processing' | 'done';
  name?: string;
  preview?: string;
}

const WardrobeMyItems = ({ onNavigate }: WardrobeMyItemsProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingItems, setProcessingItems] = useState<ProcessingItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const categories = ["All", "Tops", "Bottoms", "Layers", "Dresses", "Shoes", "Accessories"];

  const features = [
    { icon: DoorOpen, title: "Your\nCloset", view: 'items' as const, active: true },
    { icon: Sparkles, title: "Outfit\nGenerator", view: 'suggestion' as const, active: false },
    { icon: Calendar, title: "Daily\nCalendar", view: 'calendar' as const, active: false },
    { icon: Shirt, title: "Your\nLookbook", view: 'lookbook' as const, active: false },
  ];

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setItems([]);
      return;
    }
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load wardrobe items.",
        variant: "destructive",
      });
      return;
    }

    // Remove duplicates based on name, category, and color
    const uniqueItems = data?.reduce((acc: any[], current: any) => {
      const isDuplicate = acc.some(item => 
        item.category?.toLowerCase() === current.category?.toLowerCase() &&
        item.name?.toLowerCase() === current.name?.toLowerCase() &&
        item.color?.toLowerCase() === current.color?.toLowerCase()
      );
      if (!isDuplicate) {
        acc.push(current);
      }
      return acc;
    }, []);

    setItems(uniqueItems || []);
  };

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

      fetchItems();
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

    const file = files[0];
    setLoading(true);
    setProgress(10);

    // Initialize processing tiles
    const tempId = Date.now().toString();
    setProcessingItems([{ id: tempId, status: 'processing' }]);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        throw new Error("Authentication required");
      }

      const user = session.user;

      // Fetch existing items for duplicate checking
      const { data: existingItems } = await supabase
        .from('wardrobe_items')
        .select('name, category, color')
        .eq('user_id', user.id);

      // Upload the original image first to get a public URL
      const ext = file.name.split('.').pop() || 'png';
      const sourceName = `${user.id}/wardrobe_src_${Date.now()}.${ext}`;
      const { error: srcUploadError } = await supabase.storage
        .from('outfits')
        .upload(sourceName, file);
      if (srcUploadError) throw srcUploadError;
      const { data: { publicUrl: sourceUrl } } = supabase.storage
        .from('outfits')
        .getPublicUrl(sourceName);

      setProgress(30);

      const { data, error } = await supabase.functions.invoke('process-wardrobe', {
        body: { imageUrl: sourceUrl }
      });
      
      setProgress(60);

      if (error) {
        console.error('Process error:', error);
        toast({
          title: "Processing failed",
          description: "Couldn’t analyze the photo. Try another image with clear items.",
          variant: "destructive",
        });
        setProcessingItems([]);
        setLoading(false);
        setProgress(0);
        return;
      }
      
      const itemsDetected = data?.items || [];
      if (!itemsDetected || itemsDetected.length === 0) {
        toast({
          title: "No items detected",
          description: "Try a clearer outfit photo with items fully visible.",
        });
        setProcessingItems([]);
        setLoading(false);
        setProgress(0);
        return;
      }

      if (!data?.compositeImageUrl || !data?.gridLayout) {
        toast({
          title: "Processing incomplete",
          description: "Failed to process composite image. Please try again.",
          variant: "destructive",
        });
        setProcessingItems([]);
        setLoading(false);
        setProgress(0);
        return;
      }

      // Update processing tiles with actual items
      setProcessingItems(itemsDetected.map((item: any, idx: number) => ({
        id: `${tempId}-${idx}`,
        status: 'processing',
        name: item.name,
      })));

      let addedCount = 0;
      let skippedCount = 0;
      setProgress(70);

      // Crop the composite image
      const croppedBlobs = await cropCompositeImage(
        data.compositeImageUrl,
        data.gridLayout
      );

      // Process all items
      for (let idx = 0; idx < itemsDetected.length; idx++) {
        const item = itemsDetected[idx];
        const croppedBlob = croppedBlobs[idx];
        
        if (!croppedBlob) continue;

        // Check for duplicates
        const isDuplicate = existingItems?.some(existing => 
          existing.category?.toLowerCase() === item.category?.toLowerCase() &&
          (existing.name?.toLowerCase().includes(item.name?.toLowerCase()) ||
           item.name?.toLowerCase().includes(existing.name?.toLowerCase()) ||
           (existing.color?.toLowerCase() === item.color?.toLowerCase()))
        );

        if (isDuplicate) {
          console.log(`Skipping duplicate: ${item.name}`);
          skippedCount++;
          continue;
        }

        // Convert blob to base64 for completion
        const reader = new FileReader();
        const blobToBase64 = (): Promise<string> => {
          return new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(croppedBlob);
          });
        };
        
        const croppedImageData = await blobToBase64();

        // Complete the clothing image to add missing parts
        console.log(`Completing image for: ${item.name}`);
        const { data: completionData, error: completionError } = await supabase.functions.invoke('complete-clothing-image', {
          body: { 
            imageUrl: croppedImageData,
            itemType: item.category 
          }
        });

        let finalBlob = croppedBlob; // Default to cropped if completion fails

        if (!completionError && completionData?.completedImageUrl) {
          // Convert completed base64 image back to blob
          const base64Response = await fetch(completionData.completedImageUrl);
          finalBlob = await base64Response.blob();
          console.log(`Successfully completed image for: ${item.name}`);
        } else {
          console.log(`Using original cropped image for: ${item.name}`, completionError);
        }

        // Upload completed/cropped image
        const fileName = `${user.id}/wardrobe_${Date.now()}_${idx}_${item.name.replace(/\s+/g, '-')}.png`;
        const { error: uploadError } = await supabase.storage
          .from('outfits')
          .upload(fileName, finalBlob);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('outfits')
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from('wardrobe_items')
          .insert({
            user_id: user.id,
            name: item.name,
            category: item.category,
            color: item.color,
            fabric: item.fabric,
            texture: item.texture,
            pattern: item.pattern,
            style_notes: item.style_notes,
            image_url: sourceUrl,
            processed_image_url: publicUrl,
          });

        if (dbError) {
          console.error('DB error:', dbError);
        } else {
          addedCount++;
          // Mark as done
          setProcessingItems(prev => prev.map(p => 
            p.id === `${tempId}-${idx}` ? { ...p, status: 'done' } : p
          ));
        }
      }
        
        setProgress(90);

        toast({
          title: addedCount > 0 ? "Added to wardrobe!" : "Items already exist",
          description: addedCount > 0
            ? `${addedCount} new item${addedCount > 1 ? 's' : ''} added${skippedCount > 0 ? ` (${skippedCount} duplicate${skippedCount > 1 ? 's' : ''} skipped)` : ''}.`
            : `All detected items already exist in your wardrobe.`,
        });

        setProgress(100);
        fetchItems();
        
        // Clear processing tiles after 2 seconds
        setTimeout(() => {
          setProcessingItems([]);
        }, 2000);
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process image",
        variant: "destructive",
      });
      setProcessingItems([]);
    } finally {
      setLoading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredItems =
    selectedCategory === "All"
      ? items
      : items.filter((item) => item.category === selectedCategory);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Processing Tiles */}
      {processingItems.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {processingItems.map((item) => (
              <div
                key={item.id}
                className="flex-shrink-0 w-20 h-20 rounded-xl border-2 border-border overflow-hidden relative bg-muted/30"
              >
                {item.preview ? (
                  <img src={item.preview} alt={item.name || 'Processing'} className="w-full h-full object-cover" />
                ) : (
                  <Skeleton className="w-full h-full" />
                )}
                {item.status === 'processing' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {item.status === 'done' && (
                  <div className="absolute inset-0 bg-green-500/50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
          {loading && (
            <div className="mt-2">
              <Progress value={progress} className="h-1" />
            </div>
          )}
        </div>
      )}

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
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg"
                    : "bg-transparent border-border text-foreground hover:bg-muted"
                }`}
              >
                {category}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-border/50 relative bg-muted/30"
            >
              <img
                src={item.processed_image_url || item.image_url}
                alt={item.name}
                className="w-full h-full object-cover"
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
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        disabled={loading}
      />

      {/* Floating Add Button */}
      <motion.button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center shadow-2xl hover:shadow-3xl transition-all z-50 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Add wardrobe item"
      >
        {loading ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Plus className="w-8 h-8 text-white" />
        )}
      </motion.button>
    </div>
  );
};

export default WardrobeMyItems;
