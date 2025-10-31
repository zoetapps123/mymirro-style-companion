import { useState, useEffect, useRef } from "react";
import { Plus, DoorOpen, Sparkles, Calendar, Shirt, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

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

  const categories = ["All", "Tops", "Bottoms", "Layers", "Dresses", "Shoes"];

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
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*")
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
        throw error;
      }
      
      const itemsDetected = data.items || [];
        
        if (itemsDetected.length === 0) {
          throw new Error('No clothing items detected');
        }

        // Update processing tiles with actual items
        setProcessingItems(itemsDetected.map((item: any, idx: number) => ({
          id: `${tempId}-${idx}`,
          status: 'processing',
          name: item.name,
          preview: item.processedImageUrl
        })));

        let addedCount = 0;
        let skippedCount = 0;
        setProgress(70);

        // Process all items
        for (let idx = 0; idx < itemsDetected.length; idx++) {
          const item = itemsDetected[idx];
          
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

          // Determine processed image URL
          let finalProcessedUrl: string | null = null;
          if (item.processedImageUrl && typeof item.processedImageUrl === 'string') {
            if (item.processedImageUrl.startsWith('data:')) {
              // Upload base64 image
              const fileName = `${user.id}/wardrobe_${Date.now()}_${idx}.png`;
              const base64Data = item.processedImageUrl.split(',')[1];
              const binaryData = atob(base64Data);
              const bytes = new Uint8Array(binaryData.length);
              for (let i = 0; i < binaryData.length; i++) {
                bytes[i] = binaryData.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: 'image/png' });

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
              finalProcessedUrl = publicUrl;
            } else {
              // Already a public URL
              finalProcessedUrl = item.processedImageUrl;
            }
          }

          const { error: dbError } = await supabase
            .from('wardrobe_items')
            .insert({
              user_id: user.id,
              name: item.name,
              category: item.category,
              color: item.color,
              image_url: sourceUrl,
              processed_image_url: finalProcessedUrl || sourceUrl,
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

      {/* Title */}
      <div className="px-4 pb-3">
        <h2 className="text-3xl font-bold">My Items</h2>
      </div>

      {/* Category Filter */}
      <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full min-h-[36px] ${
                selectedCategory === category
                  ? "bg-black text-white hover:bg-black/90"
                  : "bg-transparent border-border text-foreground hover:bg-muted"
              }`}
            >
              {category}
            </Button>
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
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform active:scale-95 z-50 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Add wardrobe item"
      >
        {loading ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Plus className="w-8 h-8 text-white" />
        )}
      </button>
    </div>
  );
};

export default WardrobeMyItems;
