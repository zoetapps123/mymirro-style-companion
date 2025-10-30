import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Plus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface OnboardingPhotosProps {
  onComplete: () => void;
}

const OnboardingPhotos = ({ onComplete }: OnboardingPhotosProps) => {
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = [...photos, ...files];
    setPhotos(newPhotos);

    // Create previews
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

      // Process each photo for wardrobe items
      for (const url of uploadedUrls) {
        const reader = new FileReader();
        const blob = await fetch(url).then(r => r.blob());
        
        reader.onloadend = async () => {
          const base64data = reader.result?.toString().split(',')[1];
          
          try {
            const { data: processData, error: processError } = await supabase.functions.invoke(
              'process-wardrobe',
              { body: { image: base64data } }
            );

            if (processError) {
              console.error("Process error:", processError);
              return;
            }

            // Store detected items in wardrobe
            if (processData?.items) {
              for (const item of processData.items) {
                await supabase.from('wardrobe_items').insert({
                  user_id: user.id,
                  name: item.name,
                  category: item.category,
                  color: item.color,
                  processed_image_url: item.processed_image_url,
                  image_url: url,
                });
              }
            }
          } catch (err) {
            console.error("Error processing wardrobe:", err);
          }
        };
        
        reader.readAsDataURL(blob);
      }

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
        <h1 className="text-4xl font-bold text-center mb-8" style={{ fontFamily: 'cursive' }}>
          MyMirro
        </h1>

        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">Drop your fits here</h2>
            <p className="text-muted-foreground">
              Upload at least 3 outfit pics – the more you share, the better I get at styling you.
            </p>
          </div>

          {/* Photo Grid */}
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="relative aspect-square">
                {previews[index] ? (
                  <div className="relative w-full h-full">
                    <img
                      src={previews[index]}
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
                ) : (
                  <label className="w-full h-full bg-white border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors">
                    <Plus className="w-8 h-8 text-gray-400" />
                    <span className="text-xs text-gray-500 mt-1">{index + 1}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={loading}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>

          {photos.length >= 3 && (
            <p className="text-sm text-green-600 font-medium">
              ✓ {photos.length} photos uploaded
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
