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
      // Check authentication first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
      }
      
      if (!session?.user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to use this feature",
          variant: "destructive",
        });
        setLoading(false);
        setScanning(false);
        return;
      }

      const user = session.user;

      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;
        setUploadedImage(imageData);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data, error } = await supabase.functions.invoke('score-outfit', {
          body: { imageData, occasion: selectedOccasion }
        });

        if (error) {
          console.error('Score outfit error:', error);
          const status = (error as any)?.context?.response?.status;
          const errorMessage = (error as any)?.message || 'Unknown error';
          setScanning(false);
          setLoading(false);
          
          if (status === 429) {
            toast({ title: 'Rate limited', description: 'Too many requests. Please try again in a minute.', variant: 'destructive' });
          } else if (status === 402) {
            toast({ title: 'Service temporarily unavailable', description: 'Please try again later.', variant: 'destructive' });
          } else {
            toast({ 
              title: 'Scoring failed', 
              description: `Unable to analyze outfit. ${errorMessage}`, 
              variant: 'destructive' 
            });
          }
          return;
        }

        if (!data) {
          console.error('No data returned from score-outfit');
          setScanning(false);
          setLoading(false);
          toast({ title: 'Error', description: 'No response from server. Try again.', variant: 'destructive' });
          return;
        }

        // Show results immediately, persist in background
        setScanning(false);
        setResult({ ...data, image_url: imageData });
        setLoading(false);
        toast({ title: 'Score complete!', description: `${data.outfit_name}: ${data.overall_score.toFixed(1)}/5.0` });

        // Background persistence (non-blocking)
        (async () => {
          try {
            const fileName = `style-check-${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage
              .from('outfits')
              .upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('outfits')
              .getPublicUrl(fileName);

            await supabase.from('style_checks').insert({
              user_id: user.id,
              image_url: publicUrl,
              overall_score: data.overall_score,
              color_score: data.color_score,
              fit_score: data.fit_score,
              texture_score: data.texture_score,
              occasion_score: data.occasion_score,
              outfit_name: data.outfit_name,
              verdict_positive: data.what_works || data.verdict_positive,
              verdict_improvements: data.what_could_be_better || data.verdict_improvements,
              occasion: selectedOccasion
            });

            // Update result with public URL once saved
            setResult((prev: any) => prev ? { ...prev, image_url: publicUrl } : prev);

            // Auto-extract all items to wardrobe with duplicate checking
            try {
              const { data: existingItems } = await supabase
                .from('wardrobe_items')
                .select('name, category, color')
                .eq('user_id', user.id);

              const extractResponse = await fetch(publicUrl);
              const extractBlob = await extractResponse.blob();
              const extractReader = new FileReader();
              extractReader.onloadend = async () => {
                const extractImageData = extractReader.result as string;
                const { data: wardrobeData, error: wardrobeError } = await supabase.functions.invoke('process-wardrobe', {
                  body: { imageData: extractImageData }
                });

                if (!wardrobeError && wardrobeData && wardrobeData.items) {
                  let addedCount = 0;
                  let skippedCount = 0;

                  for (const item of wardrobeData.items) {
                    const isDuplicate = existingItems?.some(existing => 
                      existing.category?.toLowerCase() === item.category?.toLowerCase() &&
                      (existing.name?.toLowerCase().includes(item.name?.toLowerCase()) ||
                       item.name?.toLowerCase().includes(existing.name?.toLowerCase()) ||
                       (existing.color?.toLowerCase() === item.color?.toLowerCase() &&
                        Math.abs(existing.name?.length - item.name?.length) < 5))
                    );

                    if (isDuplicate) {
                      console.log(`Skipping duplicate item: ${item.name}`);
                      skippedCount++;
                      continue;
                    }

                    const wardrobeFileName = `${Date.now()}-${item.name.replace(/\s+/g, '-')}.png`;
                    const base64Data = item.processedImageUrl.split(',')[1];
                    const binaryData = atob(base64Data);
                    const bytes = new Uint8Array(binaryData.length);
                    for (let i = 0; i < binaryData.length; i++) bytes[i] = binaryData.charCodeAt(i);
                    const processedBlob = new Blob([bytes], { type: 'image/png' });

                    const { error: uploadProcessedError } = await supabase.storage
                      .from('outfits')
                      .upload(wardrobeFileName, processedBlob);

                    if (!uploadProcessedError) {
                      const { data: { publicUrl: wardrobePublicUrl } } = supabase.storage
                        .from('outfits')
                        .getPublicUrl(wardrobeFileName);

                      await supabase.from('wardrobe_items').insert({
                        user_id: user.id,
                        name: item.name,
                        category: item.category,
                        color: item.color,
                        image_url: wardrobePublicUrl,
                        processed_image_url: wardrobePublicUrl,
                      });
                      addedCount++;
                    }
                  }

                  if (skippedCount > 0) console.log(`Skipped ${skippedCount} duplicate items to save AI credits`);
                }
              };
              extractReader.readAsDataURL(extractBlob);
            } catch (_) {
              console.log('Auto-extract failed, continuing...');
            }
          } catch (persistErr) {
            console.error('Save failed:', persistErr);
            toast({ title: 'Saved locally', description: 'We could not sync to cloud, but your results are here.', variant: 'default' });
          }
        })();
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
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch existing wardrobe items for duplicate checking
      const { data: existingItems } = await supabase
        .from('wardrobe_items')
        .select('name, category, color')
        .eq('user_id', user!.id);

      const response = await fetch(result.image_url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;

        const { data, error } = await supabase.functions.invoke('process-wardrobe', {
          body: { imageData }
        });

        if (error) throw error;

        const itemsDetected = data.items || [];
        let addedCount = 0;
        let skippedCount = 0;

        for (const item of itemsDetected) {
          // Check for duplicates
          const isDuplicate = existingItems?.some(existing => 
            existing.category?.toLowerCase() === item.category?.toLowerCase() &&
            (existing.name?.toLowerCase().includes(item.name?.toLowerCase()) ||
             item.name?.toLowerCase().includes(existing.name?.toLowerCase()) ||
             (existing.color?.toLowerCase() === item.color?.toLowerCase() &&
              Math.abs(existing.name?.length - item.name?.length) < 5))
          );

          if (isDuplicate) {
            console.log(`Skipping duplicate item: ${item.name}`);
            skippedCount++;
            continue;
          }

          const fileName = `${Date.now()}-${item.name.replace(/\s+/g, '-')}.png`;
          const base64Data = item.processedImageUrl.split(',')[1];
          const binaryData = atob(base64Data);
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
          }
          const processedBlob = new Blob([bytes], { type: 'image/png' });

          const { error: uploadError } = await supabase.storage
            .from('outfits')
            .upload(fileName, processedBlob);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('outfits')
            .getPublicUrl(fileName);

          await supabase.from('wardrobe_items').insert({
            user_id: user!.id,
            name: item.name,
            category: item.category,
            color: item.color,
            image_url: publicUrl,
            processed_image_url: publicUrl,
          });
          addedCount++;
        }

        toast({
          title: "Added to wardrobe!",
          description: addedCount > 0 
            ? `${addedCount} new item${addedCount > 1 ? 's' : ''} extracted${skippedCount > 0 ? ` (${skippedCount} duplicate${skippedCount > 1 ? 's' : ''} skipped)` : ''}.`
            : `All items already exist in wardrobe.`,
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

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
    gradient.addColorStop(0, 'hsl(240, 10%, 8%)');
    gradient.addColorStop(1, 'hsl(240, 8%, 12%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // Load and draw outfit image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = result.image_url;
    });
    
    // Draw outfit image in a rounded frame
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(90, 100, 900, 900, 30);
    ctx.clip();
    const imgAspect = img.width / img.height;
    const frameAspect = 1;
    let drawWidth, drawHeight, offsetX, offsetY;
    if (imgAspect > frameAspect) {
      drawHeight = 900;
      drawWidth = drawHeight * imgAspect;
      offsetX = 90 - (drawWidth - 900) / 2;
      offsetY = 100;
    } else {
      drawWidth = 900;
      drawHeight = drawWidth / imgAspect;
      offsetX = 90;
      offsetY = 100 - (drawHeight - 900) / 2;
    }
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    ctx.restore();

    // Brand name
    ctx.fillStyle = 'hsl(295, 75%, 58%)';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MyMirro', 540, 1080);

    // Outfit name
    ctx.fillStyle = 'hsl(240, 5%, 98%)';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(result.outfit_name, 540, 1150);

    // Overall score
    ctx.font = 'bold 120px sans-serif';
    ctx.fillText(`${result.overall_score.toFixed(1)}`, 540, 1300);
    ctx.font = '32px sans-serif';
    ctx.fillStyle = 'hsl(240, 5%, 70%)';
    ctx.fillText('out of 5.0', 540, 1350);

    // Individual scores
    const subscores = [
      { label: 'Color', score: result.color_score, x: 180, y: 1480 },
      { label: 'Fit', score: result.fit_score, x: 540, y: 1480 },
      { label: 'Texture', score: result.texture_score, x: 900, y: 1480 },
      { label: 'Occasion', score: result.occasion_score, x: 540, y: 1600 }
    ];

    subscores.forEach(({ label, score, x, y }) => {
      ctx.fillStyle = 'hsl(240, 5%, 60%)';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y);
      
      ctx.fillStyle = 'hsl(180, 65%, 45%)';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(score.toFixed(1), x, y + 45);
    });

    // Positive message
    const positiveText = result.what_works || result.verdict_positive || '';
    ctx.fillStyle = 'hsl(180, 65%, 45%)';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    const words = positiveText.split(' ');
    let line = '';
    let yPos = 1720;
    for (let i = 0; i < words.length && yPos < 1850; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 900 && i > 0) {
        ctx.fillText(line, 540, yPos);
        line = words[i] + ' ';
        yPos += 40;
      } else {
        line = testLine;
      }
    }
    if (line && yPos < 1850) ctx.fillText(line, 540, yPos);

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
    <div className="flex flex-col h-full p-3 sm:p-4 space-y-3 sm:space-y-4 pb-safe">
      {scanning && uploadedImage && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 sm:space-y-6">
            <div className="relative">
              <img src={uploadedImage} alt="Analyzing" className="w-full aspect-square object-cover rounded-2xl" />
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="scanning-line"></div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-gradient-accent">Scoring Your Fit</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Analyzing color, fit, texture, and style...</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-bold text-gradient-accent">Outfit Check</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">Pro score and quick fixes for your look</p>
      </div>

      {!result && (
        <>
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-medium">Where are you heading?</label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {occasions.map(occasion => (
                <Badge
                  key={occasion}
                  variant={selectedOccasion === occasion ? "default" : "outline"}
                  className="cursor-pointer text-[11px] sm:text-xs px-2 sm:px-3 py-1 min-h-[32px] active:scale-95"
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
            className={`glass-card rounded-2xl p-6 sm:p-8 border-2 border-dashed text-center space-y-3 sm:space-y-4 transition-all active:scale-[0.98] ${
              selectedOccasion 
                ? "border-accent/50 hover:border-accent cursor-pointer" 
                : "border-border/30 opacity-60 cursor-not-allowed"
            }`}
          >
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-accent/20 flex items-center justify-center">
              <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-accent" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold mb-1">
                {selectedOccasion ? "Upload Your Outfit" : "Select Context First"}
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
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
          className="flex-1 overflow-auto space-y-3 sm:space-y-4 pb-24"
        >
          <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="relative rounded-xl overflow-hidden max-w-sm mx-auto">
              <img src={result.image_url} alt="Your outfit" className="w-full aspect-square object-cover" />
              <div className="absolute top-3 right-3 glass-card px-3 py-1.5 sm:px-4 sm:py-2 rounded-full">
                <span className="text-xl sm:text-2xl font-bold text-gradient-accent">{result.overall_score.toFixed(1)}</span>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-gradient-primary mb-1">{result.outfit_name}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Here's your outfit score</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {[
                { label: "Color", score: result.color_score },
                { label: "Fit", score: result.fit_score },
                { label: "Texture", score: result.texture_score },
                { label: "Occasion", score: result.occasion_score },
              ].map((item) => (
                <div key={item.label} className="bg-muted/20 rounded-lg p-2.5 sm:p-3">
                  <p className="text-[11px] sm:text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-lg sm:text-xl font-bold text-accent">{item.score.toFixed(1)}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                  <h4 className="text-sm sm:text-base font-semibold">What Works</h4>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {result.what_works || result.verdict_positive || "Overall, your outfit has strong elements."}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  <h4 className="text-sm sm:text-base font-semibold">Could Be Better</h4>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {result.what_could_be_better || result.verdict_improvements || "A few tweaks could elevate this look further."}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 min-h-[44px] text-sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="default" className="flex-1 min-h-[44px] text-sm" onClick={() => {
                setResult(null);
                setUploadedImage(null);
                setSelectedOccasion(null);
              }}>
                Check Another
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default OutfitCheck;
