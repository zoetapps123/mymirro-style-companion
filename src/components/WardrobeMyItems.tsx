import { useState, useEffect, useRef } from "react";
import { Plus, DoorOpen, Sparkles, Calendar, Shirt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { LoadingTile } from "@/components/ui/loading-tile";
// Image processing imported dynamically when needed

interface WardrobeMyItemsProps {
  onNavigate: (view: 'items' | 'suggestion' | 'calendar' | 'lookbook') => void;
}

const WardrobeMyItems = ({ onNavigate }: WardrobeMyItemsProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [processingItems, setProcessingItems] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const features = [
    { icon: DoorOpen, title: "Your\nCloset", view: 'items' as const, active: true },
    { icon: Sparkles, title: "Outfit\nGenerator", view: 'suggestion' as const, active: false },
    { icon: Calendar, title: "Daily\nCalendar", view: 'calendar' as const, active: false },
    { icon: Shirt, title: "Your\nLookbook", view: 'lookbook' as const, active: false },
  ];

  useEffect(() => {
    fetchItems();
    
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
      fetchItems();
    }, 2000);
    
    return () => clearInterval(pollInterval);
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

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        throw new Error("Authentication required");
      }

      const user = session.user;

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

      // Show immediate feedback with loading tile
      const currentCount = parseInt(localStorage.getItem('wardrobe_processing_count') || '0');
      localStorage.setItem('wardrobe_processing_count', (currentCount + 1).toString());
      setProcessingItems(prev => prev + 1);

      // Process in background (non-blocking)
      processImageInBackground(sourceUrl, user.id);

    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Background processing function
  const processImageInBackground = async (sourceUrl: string, userId: string) => {
    try {
      // Fetch existing items for duplicate checking
      const { data: existingItems } = await supabase
        .from('wardrobe_items')
        .select('name, category, color')
        .eq('user_id', userId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase.functions.invoke('process-wardrobe', {
        body: { imageUrl: sourceUrl },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) {
        console.error('Background process error:', error);
        const currentCount = parseInt(localStorage.getItem('wardrobe_processing_count') || '0');
        localStorage.setItem('wardrobe_processing_count', Math.max(0, currentCount - 1).toString());
        setProcessingItems(prev => Math.max(0, prev - 1));
        return;
      }

      if (!data?.items || data.items.length === 0 || !data?.extractedItems) {
        console.log('No items or extracted images in background processing');
        const currentCount = parseInt(localStorage.getItem('wardrobe_processing_count') || '0');
        localStorage.setItem('wardrobe_processing_count', Math.max(0, currentCount - 1).toString());
        setProcessingItems(prev => Math.max(0, prev - 1));
        return;
      }

      const itemsDetected = data.items;
      const extractedItems = data.extractedItems;
      let addedCount = 0;
      let skippedCount = 0;

      // Process each extracted item
      for (let idx = 0; idx < extractedItems.length; idx++) {
        const extracted = extractedItems[idx];
        const item = extracted.item;

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

        // Convert base64 to blob
        const response = await fetch(extracted.imageUrl);
        const blob = await response.blob();

        // Upload cropped image
        const fileName = `${userId}/wardrobe_${Date.now()}_${idx}_${item.name.replace(/\s+/g, '-')}.png`;
        const { error: uploadError } = await supabase.storage
          .from('outfits')
          .upload(fileName, blob);

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
            user_id: userId,
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

        if (!dbError) {
          addedCount++;
        }
      }

      console.log(`Background processing complete: Added ${addedCount} items${skippedCount > 0 ? `, skipped ${skippedCount} duplicates` : ''}`);
      
      // Refresh items list
      await fetchItems();
      const currentCount = parseInt(localStorage.getItem('wardrobe_processing_count') || '0');
      localStorage.setItem('wardrobe_processing_count', Math.max(0, currentCount - 1).toString());
      setProcessingItems(prev => Math.max(0, prev - 1));

    } catch (error) {
      console.error('Background processing failed:', error);
      const currentCount = parseInt(localStorage.getItem('wardrobe_processing_count') || '0');
      localStorage.setItem('wardrobe_processing_count', Math.max(0, currentCount - 1).toString());
      setProcessingItems(prev => Math.max(0, prev - 1));
    }
  };

  // Get dynamic categories from existing items
  const dynamicCategories = ["All", ...Array.from(new Set(items.map(item => item.category).filter(Boolean)))];

  const filteredItems =
    selectedCategory === "All"
      ? items
      : items.filter((item) => item.category === selectedCategory);

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
      <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          {dynamicCategories.map((category) => (
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
