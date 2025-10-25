import { Upload, CheckCircle, Share2, Camera, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

interface OutfitCheckProps {
  onBack: () => void;
}

const occasions = ["Casual Day Out", "Office", "Dinner Date", "Party", "Wedding", "Travel", "Interview"];

const OutfitCheck = ({ onBack }: OutfitCheckProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!selectedOccasion) {
      toast({
        title: "Context Required",
        description: "Tell me where you're wearing this — I'll judge smarter 😎",
        variant: "destructive"
      });
      return;
    }

    const file = files[0];
    setLoading(true);
    setScanning(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;
        setUploadedImage(imageData);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data, error } = await supabase.functions.invoke('score-outfit', {
          body: { imageData, occasion: selectedOccasion }
        });

        if (error) throw error;

        const fileName = `style-check-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('outfits')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('outfits')
          .getPublicUrl(fileName);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        await supabase.from('style_checks').insert({
          user_id: user.id,
          image_url: publicUrl,
          overall_score: data.overall_score,
          color_score: data.color_score,
          fit_score: data.fit_score,
          texture_score: data.texture_score,
          occasion_score: data.occasion_score,
          verdict_positive: data.verdict_positive,
          verdict_improvements: data.verdict_improvements,
          occasion: selectedOccasion
        });

        setScanning(false);
        setResult({ ...data, image_url: publicUrl });
        
        toast({
          title: "Score complete!",
          description: `${data.outfit_name}: ${data.overall_score.toFixed(1)}/5.0`,
        });
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Can't read that one well—try a clearer pic :P",
        variant: "destructive",
      });
      setScanning(false);
      setLoading(false);
    }
  };

  const extractToWardrobe = async () => {
    if (!result?.image_url) return;
    
    setLoading(true);
    try {
      const response = await fetch(result.image_url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;

        const { data, error } = await supabase.functions.invoke('process-wardrobe', {
          body: { imageData }
        });

        if (error) throw error;

        const fileName = `${Date.now()}-${data.name.replace(/\s+/g, '-')}.png`;
        const base64Data = data.processedImageUrl.split(',')[1];
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        const processedBlob = new Blob([bytes], { type: 'image/png' });

        const { error: uploadError } = await supabase.storage
          .from('outfits')
          .upload(fileName, processedBlob);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('outfits')
          .getPublicUrl(fileName);

        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('wardrobe_items').insert({
          user_id: user!.id,
          name: data.name,
          category: data.category,
          color: data.color,
          image_url: publicUrl,
          processed_image_url: publicUrl,
        });

        toast({
          title: "Added to wardrobe!",
          description: `${data.name} is now in your collection.`,
        });
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to extract. Try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
    gradient.addColorStop(0, 'hsl(240, 10%, 8%)');
    gradient.addColorStop(1, 'hsl(240, 8%, 12%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.fillStyle = 'hsl(295, 75%, 58%)';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MyMirro', 540, 120);

    ctx.fillStyle = 'hsl(240, 5%, 98%)';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(result.outfit_name, 540, 220);

    ctx.font = 'bold 96px sans-serif';
    ctx.fillText(`${result.overall_score.toFixed(1)}`, 540, 340);
    ctx.font = '36px sans-serif';
    ctx.fillText('out of 5.0', 540, 400);

    const subscores = [
      { label: 'Color', score: result.color_score, y: 540 },
      { label: 'Fit', score: result.fit_score, y: 640 },
      { label: 'Texture', score: result.texture_score, y: 740 },
      { label: 'Occasion', score: result.occasion_score, y: 840 }
    ];

    subscores.forEach(({ label, score, y }) => {
      ctx.fillStyle = 'hsl(240, 5%, 40%)';
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, 140, y);
      
      ctx.fillStyle = 'hsl(180, 65%, 45%)';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(score.toFixed(1), 940, y);
    });

    ctx.fillStyle = 'hsl(180, 65%, 45%)';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(result.verdict_positive.substring(0, 60), 540, 1000);

    ctx.fillStyle = 'hsl(240, 5%, 40%)';
    ctx.font = '32px sans-serif';
    ctx.fillText('Ready to turn heads', 540, 1780);

    const shareImage = canvas.toDataURL('image/png');
    const response = await fetch(shareImage);
    const blob = await response.blob();
    const file = new File([blob], 'mymirro-style-check.png', { type: 'image/png' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'MyMirro Style Check' });
    } else {
      const link = document.createElement('a');
      link.href = shareImage;
      link.download = 'mymirro-style-check.png';
      link.click();
      toast({ title: "Image downloaded!", description: "Share on your socials" });
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {scanning && uploadedImage && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-8 max-w-md w-full space-y-6">
            <div className="relative">
              <img src={uploadedImage} alt="Analyzing" className="w-full aspect-square object-cover rounded-2xl" />
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="scanning-line"></div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-gradient-accent">Scoring Your Fit</h3>
              <p className="text-sm text-muted-foreground">Analyzing color, fit, texture, and style...</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-accent">Outfit Check</h2>
        <p className="text-sm text-muted-foreground">Pro score and quick fixes for your look</p>
      </div>

      {!result && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Where are you heading?</label>
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

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageUpload}
            className="hidden"
            disabled={loading}
          />
          <div 
            onClick={() => {
              if (!selectedOccasion) {
                toast({
                  title: "Select Context First",
                  description: "Tell me where you're wearing this — I'll judge smarter 😎",
                  variant: "destructive"
                });
                return;
              }
              if (!loading) fileInputRef.current?.click();
            }}
            className={`glass-card rounded-2xl p-8 border-2 border-dashed text-center space-y-4 transition-all ${
              selectedOccasion 
                ? "border-accent/50 hover:border-accent cursor-pointer" 
                : "border-border/30 opacity-60 cursor-not-allowed"
            }`}
          >
            <div className="mx-auto w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
              <Camera className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">
                {selectedOccasion ? "Upload Your Outfit" : "Select Context First"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {selectedOccasion ? "Snap or select from gallery" : "Choose where you're heading above"}
              </p>
            </div>
          </div>
        </>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 overflow-auto space-y-4"
        >
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="relative rounded-xl overflow-hidden">
              <img src={result.image_url} alt="Your outfit" className="w-full aspect-square object-cover" />
              <div className="absolute top-4 right-4 glass-card px-4 py-2 rounded-full">
                <span className="text-2xl font-bold text-gradient-accent">{result.overall_score.toFixed(1)}</span>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-gradient-primary mb-1">{result.outfit_name}</h3>
              <p className="text-sm text-muted-foreground">Here's your outfit score</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Color", score: result.color_score },
                { label: "Fit", score: result.fit_score },
                { label: "Texture", score: result.texture_score },
                { label: "Occasion", score: result.occasion_score },
              ].map((item) => (
                <div key={item.label} className="bg-muted/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-lg font-bold text-accent">{item.score.toFixed(1)}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border/50 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-accent mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-base font-semibold mb-2 text-accent">What's working</p>
                  <p className="text-sm leading-relaxed">{result.verdict_positive}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-base font-semibold mb-2 text-primary">Quick fixes</p>
                  <div className="text-sm whitespace-pre-line leading-relaxed">{result.verdict_improvements}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-4">
              <Button variant="outline" onClick={extractToWardrobe} disabled={loading}>
                <Package className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
              </Button>
              <Button onClick={() => { setResult(null); setUploadedImage(null); }}>
                Try Another
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default OutfitCheck;
