import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Upload, X, Loader2, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

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
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;
    
    setPhotos(files);
    setPreviews([]);

    // Create previews for all selected files
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (photos.length < 3) {
      toast({
        title: "More photos needed",
        description: "Please upload at least 3 photos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setProgress(10);
    setStatusText("Uploading photos...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const uploadedUrls: string[] = [];
      
      // Upload all photos
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const fileExt = photo.name.split('.').pop();
        const fileName = `${user.id}/onboarding_${Date.now()}_${i}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('outfits')
          .upload(fileName, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('outfits')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
        setProgress(10 + (i / photos.length) * 30);
      }

      setProgress(40);
      setStatusText("Analyzing photos...");

      // Get existing wardrobe items for duplicate checking
      const { data: existingItems } = await supabase
        .from('wardrobe_items')
        .select('name, category, color')
        .eq('user_id', user.id);

      // Process each photo for wardrobe items (await all properly)
      let totalAdded = 0;
      for (let i = 0; i < uploadedUrls.length; i++) {
        const url = uploadedUrls[i];
        const blob = await fetch(url).then(r => r.blob());
        const base64data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result?.toString().split(',')[1] || '');
          reader.readAsDataURL(blob);
        });
        
        try {
          const { data: processData, error: processError } = await supabase.functions.invoke(
            'process-wardrobe',
            { body: { imageData: base64data } }
          );

          if (processError) {
            console.error("Process error:", processError);
            continue;
          }

          // Store detected items in wardrobe with duplicate checking
          if (processData?.items) {
            for (const item of processData.items) {
              // Check for duplicates
              const isDuplicate = existingItems?.some(existing => 
                existing.category?.toLowerCase() === item.category?.toLowerCase() &&
                (existing.name?.toLowerCase().includes(item.name?.toLowerCase()) ||
                 item.name?.toLowerCase().includes(existing.name?.toLowerCase()) ||
                 (existing.color?.toLowerCase() === item.color?.toLowerCase()))
              );

              if (isDuplicate) {
                console.log(`Skipping duplicate: ${item.name}`);
                continue;
              }

              // Upload processed image
              const fileName = `${user.id}/wardrobe_${Date.now()}_${item.name.replace(/\s+/g, '-')}.png`;
              const base64Image = item.processedImageUrl.split(',')[1];
              const binaryData = atob(base64Image);
              const bytes = new Uint8Array(binaryData.length);
              for (let j = 0; j < binaryData.length; j++) {
                bytes[j] = binaryData.charCodeAt(j);
              }
              const imageBlob = new Blob([bytes], { type: 'image/png' });

              const { error: uploadError } = await supabase.storage
                .from('outfits')
                .upload(fileName, imageBlob);

              if (uploadError) {
                console.error('Upload error:', uploadError);
                continue;
              }

              const { data: { publicUrl } } = supabase.storage
                .from('outfits')
                .getPublicUrl(fileName);

              await supabase.from('wardrobe_items').insert({
                user_id: user.id,
                name: item.name,
                category: item.category,
                color: item.color,
                processed_image_url: publicUrl,
                image_url: url,
              });

              totalAdded++;
            }
          }
        } catch (err) {
          console.error("Error processing wardrobe:", err);
        }

        setProgress(40 + ((i + 1) / uploadedUrls.length) * 30);
      }

      console.log(`Added ${totalAdded} items to wardrobe`);

      setProgress(70);
      setStatusText("Detecting body shape and skin tone...");

      // Select the first clear photo as demo stylecheck image
      const demoImage = uploadedUrls[0];

      // TODO: In production, call an AI service to detect body shape and skin tone
      // For now, we'll store placeholder values
      await supabase.from('user_profiles').update({
        demo_stylecheck_image_url: demoImage,
        body_shape: 'rectangle', // Placeholder
        skin_tone: 'medium', // Placeholder
      }).eq('id', user.id);

      setProgress(90);
      setStatusText("Finalizing...");

      await supabase.auth.updateUser({
        data: {
          onboarding_complete: true,
          demo_stylecheck_image_url: demoImage,
        }
      });

      setProgress(100);
      localStorage.setItem("onboardingComplete", "true");

      toast({
        title: "Profile Complete! 🎉",
        description: "Your wardrobe has been analyzed",
      });

      setTimeout(() => {
        onComplete();
      }, 1000);

    } catch (error: any) {
      console.error('Onboarding photos error:', error);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        {/* Logo */}
        <div className="text-center pt-4 mb-8">
          <img src={logo} alt="MyMirro" className="h-16 mx-auto" />
        </div>
        
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/50 rounded-full transition-colors mb-4"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>

        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-2 text-gray-900">Drop your fits here</h2>
            <p className="text-gray-600">
              Upload at least 3 outfit pics – the more you share, the better I get at styling you.
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
                  <img
                    src={preview}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-full object-cover rounded-2xl"
                  />
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
              {photos.length >= 3 ? (
                <span className="text-green-600">✓ {photos.length} photos uploaded</span>
              ) : (
                <span className="text-gray-600">{photos.length} photos uploaded (need {3 - photos.length} more)</span>
              )}
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
            disabled={photos.length < 3 || loading}
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
