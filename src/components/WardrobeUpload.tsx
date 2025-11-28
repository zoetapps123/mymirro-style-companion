import { Shirt, Search, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { trackPageView } from "@/lib/mixpanel";
import { SCREEN_NAMES, SCREEN_PATHS } from "@/lib/screenRoutes";
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from "@/lib/analyticsEvents";
import { trackEvent } from "@/lib/mixpanel";
import { WARDROBE_ROUTES } from "@/lib/wardrobeRoutes";
import { ItemClassificationDialog } from "./ItemClassificationDialog";
import { compressForWardrobe, dataUrlToFile } from "@/lib/imageCompression";
// Image processing functions imported dynamically when needed

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  color: string;
  processed_image_url: string | null;
}

interface WardrobeUploadProps {
  onBack: () => void;
}

const WardrobeUpload = ({ onBack }: WardrobeUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { trackClick, trackCustom, startFlow, trackFlowStep, completeFlow, trackScreenView } = useAnalytics();
  const uploadAttempts = useRef(0);
  const uploadStartTime = useRef(0);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [uncertainItem, setUncertainItem] = useState<{ preview: string; item: any; index: number } | null>(null);

  useEffect(() => {
    fetchWardrobeItems();
    trackScreenView('wardrobe-upload', {}, '/wardrobe/add-item', '/wardrobe/add-item');
    trackPageView(SCREEN_NAMES.WARDROBE_UPLOAD, SCREEN_PATHS.WARDROBE_UPLOAD);
  }, [trackScreenView]);

  const fetchWardrobeItems = async () => {
    const { data, error } = await supabase
      .from('wardrobe_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wardrobe:', error);
      return;
    }

    setItems(data || []);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    uploadAttempts.current++;
    uploadStartTime.current = Date.now();
    
    startFlow('wardrobe_upload', {
      files_count: files.length,
    });

    trackCustom(ANALYTICS_EVENTS.ADD_ITEM_IMAGE_SELECTED, {
      attempt_number: uploadAttempts.current,
      files_count: files.length,
      file_type: file.type,
      file_size_bytes: file.size,
      element_id: 'file-upload-input',
      numeric_value: file.size
    }, 'user_action:upload_start', WARDROBE_ROUTES.UPLOAD);
    
    // Track upload submit
    trackCustom(ANALYTICS_EVENTS.ADD_ITEM_CLICKED, {
      files_count: files.length,
      file_size_kb: Math.round(file.size / 1024),
      element_id: 'upload-button',
      numeric_value: files.length
    }, 'user_action:upload_start', WARDROBE_ROUTES.UPLOAD);

    setLoading(true);
    setProgress(10);

    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        console.error('Auth error:', sessionError);
        toast({
          title: "Authentication required",
          description: "Please sign in again to add items to your wardrobe",
          variant: "destructive",
        });
        setLoading(false);
        // Clear storage and reload
        localStorage.clear();
        window.location.reload();
        return;
      }

      const user = session.user;

      // Fetch existing wardrobe items for duplicate checking
      const { data: existingItems } = await supabase
        .from('wardrobe_items')
        .select('name, category, color')
        .eq('user_id', user.id);

      // Compress image for wardrobe AI analysis
      setStatusText("Compressing image...");
      setProgress(15);
      
      const compressedDataUrl = await compressForWardrobe(file);
      const compressedFile = dataUrlToFile(
        compressedDataUrl, 
        file.name.replace(/\.[^.]+$/, '.jpg')
      );

      console.log(`Image compressed: ${file.size} bytes → ${compressedFile.size} bytes (${((1 - compressedFile.size / file.size) * 100).toFixed(1)}% reduction)`);

      // Track compression metrics
      trackCustom(ANALYTICS_EVENTS.ADD_ITEM_IMAGE_SELECTED, {
        attempt_number: uploadAttempts.current,
        files_count: files.length,
        file_type: file.type,
        file_size_bytes: file.size,
        compressed_size_bytes: compressedFile.size,
        compression_ratio: (1 - compressedFile.size / file.size).toFixed(2),
        element_id: 'file-upload-input',
        numeric_value: compressedFile.size
      }, 'user_action:upload_start', WARDROBE_ROUTES.UPLOAD);

      // Upload the compressed image to storage
      setStatusText("Uploading...");
      setProgress(25);
      trackFlowStep('wardrobe_upload', 'file_selected', {
        file_type: compressedFile.type,
        file_size: compressedFile.size,
        original_size: file.size,
      });

      const uploadPath = `${user.id}/wardrobe_uploads/${Date.now()}_${compressedFile.name.replace(/\s+/g, '-')}`;
      const { error: uploadError } = await supabase.storage
        .from('outfits')
        .upload(uploadPath, compressedFile, {
          contentType: compressedFile.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast({
          title: 'Upload failed',
          description: 'Could not upload image. Please try again.',
          variant: 'destructive',
        });
        setLoading(false);
        setProgress(0);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('outfits').getPublicUrl(uploadPath);
      const imageUrl = publicUrlData.publicUrl;

      setStatusText("Analyzing...");
      setProgress(40);

      // Invoke with exponential backoff on rate limits (429)
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      if (!freshSession?.access_token) {
        console.error('Authentication required');
        setLoading(false);
        setProgress(0);
        return;
      }

      async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

      const maxAttempts = 3;
      let attempt = 0;
      let invokeData: any = null;
      let invokeError: any = null;

      // Check if running in iframe (Lovable preview)
      const isInIframe = window.self !== window.top;
      
      while (attempt < maxAttempts) {
        const { data, error } = await supabase.functions.invoke('process-wardrobe', {
          body: { imageUrl },
          headers: { Authorization: `Bearer ${freshSession.access_token}` },
        });

        // Check for iframe blocking (Failed to fetch)
        if (error && error.message === 'Failed to fetch' && isInIframe) {
          toast({
            title: 'Preview Limitation',
            description: 'Image upload is blocked in preview. Please open in a new tab to upload.',
            variant: 'destructive',
          });
          setLoading(false);
          setProgress(0);
          return;
        }

        // If success and not rate-limit sentinel from backend, stop
        const isRateLimited = !!(error && /429|rate/i.test(error?.message || '')) ||
                              (!!data && data.code === 'RATE_LIMIT' && data.retryable);

        if (!isRateLimited && !error) {
          invokeData = data;
          break;
        }

        attempt++;
        if (attempt >= maxAttempts) {
          invokeError = error || data;
          break;
        }

        const backoffs = [2000, 5000, 8000];
        const wait = backoffs[attempt - 1] || 8000;
        console.warn(`Rate limited calling process-wardrobe, retry ${attempt}/${maxAttempts} in ${wait}ms`);
        toast({
          title: 'AI is busy',
          description: `Retrying analysis... (${attempt}/${maxAttempts})`,
        });
        await sleep(wait);
      }

      setProgress(60);

      if (!invokeData) {
        console.error('Process wardrobe error:', invokeError);
        toast({
          title: 'Processing failed',
          description: 'The AI service is busy. Please try again in a few seconds.',
          variant: 'destructive',
        });
        setLoading(false);
        setProgress(0);
        return;
      }

      console.log('Wardrobe processing response:', invokeData);

      // Edge returns items with imageUrl; normalize to processedImageUrl for downstream logic
      const itemsDetected = (invokeData?.items || []).map((it: any) => ({
        ...it,
        processedImageUrl: it.processedImageUrl || it.imageUrl,
      }));

      if (!itemsDetected || itemsDetected.length === 0) {
        toast({
          title: 'No items detected',
          description: 'Try a clearer outfit photo with items fully visible.',
        });
        setLoading(false);
        setProgress(0);
        return;
      }

      let addedCount = 0;
      let skippedCount = 0;
      setProgress(70);

      console.log('Processing items with AI-generated images');

      // Process each item - backend already handled deduplication
      for (let idx = 0; idx < itemsDetected.length; idx++) {
        const item = itemsDetected[idx];

        // Use the processedImageUrl from backend (already generated and uploaded)
        if (!item.processedImageUrl) {
          console.warn(`Item ${idx} missing processedImageUrl`);
          skippedCount++;
          continue;
        }

        const { mapDetectedItemToDbRecord } = await import('@/lib/wardrobeItemMapper');
        const { data: insertedRows, error: dbError } = await supabase
          .from('wardrobe_items')
          .insert([
            mapDetectedItemToDbRecord(item, user.id, item.processedImageUrl, item.processedImageUrl)
          ]).select('*');

        if (dbError) {
          console.error('DB error for item:', item.name, dbError);
        } else {
          addedCount++;
        }
      }
      
      setProgress(90);

      const totalDetected = itemsDetected.length;
      const successfullyAdded = addedCount;
      
      const uploadDuration = Date.now() - uploadStartTime.current;
      
      completeFlow('wardrobe_upload', true, {
        items_detected: totalDetected,
        items_added: successfullyAdded,
        items_skipped: skippedCount,
        duration_ms: uploadDuration,
        attempt_number: uploadAttempts.current,
      });

      trackCustom('upload_success', {
        items_added: successfullyAdded,
        duration_seconds: Math.floor(uploadDuration / 1000),
        attempt_number: uploadAttempts.current,
      }, 'system:processing_complete');

      // Track upload completion
      trackCustom('wardrobe_upload_completed', {
        items_detected: totalDetected,
        items_added: successfullyAdded,
        items_skipped: skippedCount,
        duration_seconds: Math.floor(uploadDuration / 1000),
      }, 'user_action:complete_upload');
      
      // Reset attempts on success
      uploadAttempts.current = 0;

      toast({
        title: 'Items added!',
        description: `${successfullyAdded} new item${successfullyAdded > 1 ? 's' : ''} in your wardrobe`,
      });

      // Track wardrobe item additions
      trackCustom('wardrobe_items_added', {
        items_added: addedCount,
        items_skipped: skippedCount,
        total_detected: itemsDetected.length,
        upload_method: 'manual_photo'
      }, 'user_action:add_items');
      
      // Mixpanel: Track wardrobe item added
      trackEvent('wardrobe_item_added', {
        items_added: successfullyAdded,
        items_skipped: skippedCount,
        total_detected: totalDetected,
        duration_seconds: Math.floor(uploadDuration / 1000)
      });

      setProgress(100);
      fetchWardrobeItems();

    } catch (error) {
      console.error('Error processing image:', error);
      
      // Track upload error
      trackCustom('wardrobe_upload_error', {
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }, 'system:error');

      toast({
        title: "Error",
        description: "Failed to process image. Please try again with a clear photo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const filteredItems = selectedCategory === "all" 
    ? items 
    : items.filter(item => item.category.toLowerCase() === selectedCategory);

  return (
    <div className="flex flex-col h-full p-4 space-y-4 relative">
      {/* Classification Dialog */}
      <ItemClassificationDialog
        open={!!uncertainItem}
        onClose={() => setUncertainItem(null)}
        onSelect={(category) => {
          if (uncertainItem) {
            // Update the item category and continue processing
            const updatedItem = { ...uncertainItem.item, category };
            // Process with corrected category
            console.log('User corrected category to:', category);
          }
          setUncertainItem(null);
        }}
        itemPreview={uncertainItem?.preview}
      />

      {/* Processing Overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
          <div className="glass-card p-8 rounded-3xl max-w-md w-full mx-4 space-y-6 animate-scale-in">
            <div className="flex items-center justify-center">
              <div className="relative">
                <Sparkles className="w-16 h-16 text-primary animate-pulse" />
                <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2 text-center">
              <h3 className="text-xl font-semibold text-gradient-primary">
                Extracting Items
              </h3>
              <p className="text-sm text-muted-foreground">
                {statusText || "AI is analyzing your image and isolating each clothing item..."}
              </p>
            </div>

            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {progress < 20 && "Compressing image..."}
                {progress >= 20 && progress < 40 && "Uploading..."}
                {progress >= 40 && progress < 60 && "Detecting items..."}
                {progress >= 60 && progress < 90 && "Processing items..."}
                {progress >= 90 && "Almost done..."}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="aspect-square rounded-xl" />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Your Items</h2>
        <p className="text-sm text-muted-foreground">
          Shoot your clothes—watch MyMirro catalog them cleanly.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search your wardrobe..."
            className="pl-10 glass-card border-border/50"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
          disabled={loading}
        />
        <Button 
          className="glow-primary gap-2"
          onClick={() => {
            trackClick('wardrobe_add_items_button', 'add-items', { feature: 'wardrobe_upload' });
            fileInputRef.current?.click();
          }}
          disabled={loading}
        >
          <Plus className="w-5 h-5" />
          Add Items
        </Button>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col">
        <TabsList className="glass-card border-border/50">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="tops">Tops</TabsTrigger>
          <TabsTrigger value="bottoms">Bottoms</TabsTrigger>
          <TabsTrigger value="layers">Layers</TabsTrigger>
          <TabsTrigger value="dresses">Dresses</TabsTrigger>
          <TabsTrigger value="shoes">Shoes</TabsTrigger>
          <TabsTrigger value="accessories">Accessories</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="flex-1 mt-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <Shirt className="w-16 h-16 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No items yet. Upload your first piece!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="glass-card p-4 rounded-2xl space-y-3 hover:glow-accent transition-all cursor-pointer"
                >
                  <div className="aspect-square bg-muted/20 rounded-xl flex items-center justify-center overflow-hidden">
                    {item.processed_image_url ? (
                      <img 
                        src={item.processed_image_url} 
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Shirt className="w-16 h-16 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border-2 border-border"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-muted-foreground">Primary</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WardrobeUpload;
