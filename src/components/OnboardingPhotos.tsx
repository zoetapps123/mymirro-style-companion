import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Upload, X, Loader2, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { LoadingTile } from "@/components/ui/loading-tile";

interface OnboardingPhotosProps {
  onComplete: () => void;
  onBack: () => void;
}

const OnboardingPhotos = ({ onComplete, onBack }: OnboardingPhotosProps) => {
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [existingItemsCount, setExistingItemsCount] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);
  const { toast } = useToast();

  // Check existing wardrobe items count
  useEffect(() => {
    const checkExistingItems = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: items } = await supabase.from("wardrobe_items").select("id").eq("user_id", user.id);
        setExistingItemsCount(items?.length || 0);
      }
    };
    checkExistingItems();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    setPhotos((prev) => [...prev, ...files]);

    // Create previews for all selected files
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const minRequired = Math.max(0, 3 - existingItemsCount);
    if (photos.length < minRequired) {
      toast({
        title: "More photos needed",
        description: `Please upload at least ${minRequired} more photo${minRequired !== 1 ? "s" : ""}`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setProgress(10);
    setStatusText("Uploading photos...");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const uploadedUrls: string[] = [];

      // Upload all photos
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const fileExt = photo.name.split(".").pop();
        const fileName = `${user.id}/onboarding_${Date.now()}_${i}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage.from("outfits").upload(fileName, photo);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("outfits").getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
        setProgress(10 + (i / photos.length) * 80);
      }

      setProgress(90);
      setStatusText("Setting up your profile...");

      // Set up basic profile immediately
      const demoImage = uploadedUrls[0];
      await supabase.from("user_profiles").upsert({
        id: user.id,
        demo_stylecheck_image_url: demoImage,
        body_shape: "rectangle",
        skin_tone: "medium",
      });

      await supabase.auth.updateUser({
        data: {
          onboarding_complete: true,
          demo_stylecheck_image_url: demoImage,
        },
      });

      setProgress(100);
      localStorage.setItem("onboardingComplete", "true");

      toast({
        title: "Welcome to MyMirro! 🎉",
        description: "Processing your wardrobe items...",
      });

      // Set initial processing count
      const processingCount = uploadedUrls.length;
      localStorage.setItem("wardrobe_processing_count", processingCount.toString());
      setProcessingCount(processingCount);

      // Process images in the background (non-blocking)
      processImagesInBackground(uploadedUrls, user.id);

      // Let user proceed to app after a brief delay
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error: any) {
      console.error("Onboarding photos error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process photos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProgress(0);
      setStatusText("");
    }
  };

  // Background processing function with rate limit handling
  const processImagesInBackground = async (urls: string[], userId: string) => {
    try {
      // Get existing wardrobe items for duplicate checking (include primary_color and brand)
      const { data: existingItems } = await supabase
        .from("wardrobe_items")
        .select("name, category, color, primary_color, brand")
        .eq("user_id", userId);

      let totalAdded = 0;

      // Process images sequentially with delays to avoid rate limits
      for (let urlIdx = 0; urlIdx < urls.length; urlIdx++) {
        const url = urls[urlIdx];

        // Add delay between requests (except for first one)
        if (urlIdx > 0) {
          console.log(`Waiting 2 seconds before processing next image...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error("Authentication required");
          }

          console.log(`Processing image ${urlIdx + 1}/${urls.length} (please wait)...`);

          // Retry logic with exponential backoff
          let retryCount = 0;
          const maxRetries = 2;
          let processData = null;
          let processError = null;

          while (retryCount <= maxRetries) {
            const result = await supabase.functions.invoke("process-wardrobe", {
              body: { imageUrl: url },
              headers: { Authorization: `Bearer ${session.access_token}` },
            });

            processData = result.data;
            processError = result.error;

            // Check if it's a rate limit error
            if (processError) {
              const errorMsg = processError.message?.toLowerCase() || "";
              const isRateLimit = errorMsg.includes("rate") || errorMsg.includes("429") || errorMsg.includes("busy");

              if (isRateLimit && retryCount < maxRetries) {
                const waitTime = Math.pow(2, retryCount) * 3000; // 3s, 6s
                console.log(`Rate limit hit, retrying in ${waitTime / 1000} seconds...`);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
                retryCount++;
                continue;
              }
            }

            // Success or non-retryable error
            break;
          }

          if (processError) {
            console.error("Background process error:", processError);
            const currentCount = parseInt(localStorage.getItem("wardrobe_processing_count") || "0");
            localStorage.setItem("wardrobe_processing_count", Math.max(0, currentCount - 1).toString());
            setProcessingCount((prev) => Math.max(0, prev - 1));
            continue;
          }

          if (processData?.items && processData.items.length > 0) {
            // Items come with generated images from Gemini
            const { isLikelyDuplicateWardrobeItem } = await import("@/lib/wardrobeDeduplication");
            
            for (const item of processData.items) {
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
                continue;
              }

              // Item already has imageUrl from Gemini generation
              const { mapDetectedItemToDbRecord } = await import("@/lib/wardrobeItemMapper");
              await supabase
                .from("wardrobe_items")
                .insert([mapDetectedItemToDbRecord(item, userId, item.imageUrl, item.imageUrl)]);

              totalAdded++;
            }
          }
        } catch (err) {
          console.error("Error processing wardrobe item:", err);
        } finally {
          const currentCount = parseInt(localStorage.getItem("wardrobe_processing_count") || "0");
          localStorage.setItem("wardrobe_processing_count", Math.max(0, currentCount - 1).toString());
          setProcessingCount((prev) => Math.max(0, prev - 1));
        }
      }

      console.log(`Background processing complete: Added ${totalAdded} items to wardrobe`);
    } catch (error) {
      console.error("Background processing failed:", error);
      localStorage.setItem("wardrobe_processing_count", "0");
      setProcessingCount(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mx-auto">
        {/* Logo */}
        <div className="text-center pt-4 mb-8">
          <img src={logo} alt="MyMirro" className="h-16 mx-auto" />
        </div>

        {/* Back Button */}
        <button onClick={onBack} className="p-2 hover:bg-white/50 rounded-full transition-colors mb-4">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>

        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-2 text-gray-900">Drop your fits here</h2>
            <p className="text-gray-600">
              {existingItemsCount > 0 ? (
                <>
                  You have {existingItemsCount} item{existingItemsCount !== 1 ? "s" : ""} uploaded. Upload{" "}
                  {3 - existingItemsCount} more to continue – the more you share, the better I get at styling you.
                </>
              ) : (
                <>Upload at least 3 outfit pics – the more you share, the better I get at styling you.</>
              )}
            </p>
          </div>

          {/* Batch Upload Button */}
          <label className="w-full h-32 bg-white border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors group">
            <Upload className="w-12 h-12 text-gray-400 group-hover:text-gray-500 mb-2" />
            <span className="text-lg font-semibold text-gray-700">Upload Photos</span>
            <span className="text-sm text-gray-500 mt-1">Select multiple outfit images</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={loading}
            />
          </label>

          {/* Photo Preview Grid */}
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {previews.map((preview, index) => (
                <div key={index} className="relative aspect-square">
                  <img src={preview} alt={`Upload ${index + 1}`} className="w-full h-full object-cover rounded-2xl" />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {photos.length > 0 && (
            <p className="text-sm font-medium text-gray-700">
              {(() => {
                const minRequired = Math.max(0, 3 - existingItemsCount);
                const totalAfterUpload = existingItemsCount + photos.length;
                return totalAfterUpload >= 3 ? (
                  <span className="text-green-600">
                    ✓ {photos.length} photos selected (total: {totalAfterUpload} items)
                  </span>
                ) : (
                  <span className="text-gray-600">
                    {photos.length} photos selected (need {minRequired - photos.length} more)
                  </span>
                );
              })()}
            </p>
          )}

          {loading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">{statusText}</p>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={existingItemsCount + photos.length < 3 || loading}
            className="w-full h-14 bg-black hover:bg-black/90 text-white text-lg font-semibold rounded-2xl"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Begin your style journey"
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingPhotos;
