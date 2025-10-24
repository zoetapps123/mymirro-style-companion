import { Upload, CheckCircle, Share2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface StyleScore {
  id: string;
  overall_score: number;
  color_score: number;
  fit_score: number;
  texture_score: number;
  occasion_score: number;
  verdict_positive: string;
  verdict_improvements: string;
  occasion: string | null;
  created_at: string;
  image_url: string;
}

const StyleCheck = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [latestScore, setLatestScore] = useState<StyleScore | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestScore();
  }, []);

  const fetchLatestScore = async () => {
    const { data, error } = await supabase
      .from('style_checks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching score:', error);
      return;
    }

    setLatestScore(data);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setLoading(true);
    setScanning(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;
        setUploadedImage(imageData);

        await new Promise(resolve => setTimeout(resolve, 2000)); // Scanning animation duration

        // Score with AI
        const { data, error } = await supabase.functions.invoke('score-outfit', {
          body: { imageData, occasion: null }
        });

        if (error) {
          console.error('Score outfit error:', error);
          throw error;
        }
        
        console.log('Score outfit response:', data);

        // Upload image to storage
        const fileName = `style-check-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('outfits')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('outfits')
          .getPublicUrl(fileName);

        // Save to database
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error: dbError } = await supabase
          .from('style_checks')
          .insert({
            user_id: user.id,
            image_url: publicUrl,
            overall_score: data.overall_score,
            color_score: data.color_score,
            fit_score: data.fit_score,
            texture_score: data.texture_score,
            occasion_score: data.occasion_score,
            verdict_positive: data.verdict_positive,
            verdict_improvements: data.verdict_improvements,
          });

        if (dbError) throw dbError;

        setScanning(false);
        
        toast({
          title: "Score complete!",
          description: `Overall: ${data.overall_score}/5.0`,
        });

        fetchLatestScore();
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to analyze outfit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  const extractToWardrobe = async () => {
    if (!latestScore || !latestScore.image_url) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to add items to wardrobe",
          variant: "destructive",
        });
        return;
      }

      // Fetch the image and convert to base64
      const response = await fetch(latestScore.image_url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const imageData = reader.result as string;

        toast({
          title: "Extracting clothing...",
          description: "Processing items for your wardrobe...",
        });

        const { data, error } = await supabase.functions.invoke('process-wardrobe', {
          body: { imageData }
        });

        if (error) throw error;

        // Upload processed image
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

        const { error: dbError } = await supabase
          .from('wardrobe_items')
          .insert({
            user_id: user.id,
            name: data.name,
            category: data.category,
            color: data.color,
            image_url: publicUrl,
            processed_image_url: publicUrl,
          });

        if (dbError) throw dbError;

        toast({
          title: "Added to wardrobe!",
          description: `${data.name} is now in your wardrobe.`,
        });
      };
    } catch (error) {
      console.error('Error extracting to wardrobe:', error);
      toast({
        title: "Error",
        description: "Failed to extract clothing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateShareImage = async (): Promise<string> => {
    return new Promise((resolve) => {
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

      // MyMirro branding
      ctx.fillStyle = 'hsl(295, 75%, 58%)';
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MyMirro', 540, 120);

      // Style Score
      ctx.fillStyle = 'hsl(240, 5%, 98%)';
      ctx.font = 'bold 96px sans-serif';
      ctx.fillText(`${latestScore!.overall_score.toFixed(1)}`, 540, 280);
      ctx.font = '36px sans-serif';
      ctx.fillText('out of 5.0', 540, 340);

      // Subscores
      const subscores = [
        { label: 'Color', score: latestScore!.color_score, y: 480 },
        { label: 'Fit', score: latestScore!.fit_score, y: 580 },
        { label: 'Texture', score: latestScore!.texture_score, y: 680 },
        { label: 'Occasion', score: latestScore!.occasion_score, y: 780 }
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

      // What's Working
      ctx.fillStyle = 'hsl(180, 65%, 45%)';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText("What's Working", 80, 920);
      
      ctx.fillStyle = 'hsl(240, 5%, 70%)';
      ctx.font = '28px sans-serif';
      const positiveLines = wrapText(ctx, latestScore!.verdict_positive, 920);
      positiveLines.forEach((line, i) => {
        ctx.fillText(line, 80, 980 + (i * 40));
      });

      // Quick Fixes
      const quickFixesY = 980 + (positiveLines.length * 40) + 80;
      ctx.fillStyle = 'hsl(295, 75%, 58%)';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText('Quick Fixes', 80, quickFixesY);
      
      ctx.fillStyle = 'hsl(240, 5%, 98%)';
      ctx.font = '28px sans-serif';
      const improvementLines = wrapText(ctx, latestScore!.verdict_improvements, 920);
      improvementLines.forEach((line, i) => {
        ctx.fillText(line, 80, quickFixesY + 60 + (i * 40));
      });

      // CTA
      ctx.fillStyle = 'hsl(240, 5%, 40%)';
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Check your style at', 540, 1780);
      ctx.fillStyle = 'hsl(295, 75%, 58%)';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText('mymirro.app', 540, 1840);

      resolve(canvas.toDataURL('image/png'));
    });
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const handleShare = async () => {
    if (!latestScore) return;

    try {
      setLoading(true);
      const shareImage = await generateShareImage();
      
      // Convert to blob
      const response = await fetch(shareImage);
      const blob = await response.blob();
      const file = new File([blob], 'mymirro-style-score.png', { type: 'image/png' });

      const shareData = {
        files: [file],
        title: 'MyMirro Style Score',
        text: `My MyMirro Style Score: ${latestScore.overall_score}/5.0\n\nCheck your style at mymirro.app 👔✨`
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: download image
        const link = document.createElement('a');
        link.href = shareImage;
        link.download = 'mymirro-style-score.png';
        link.click();
        
        toast({
          title: "Image downloaded!",
          description: "Share your MyMirro score on social media",
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      toast({
        title: "Error",
        description: "Failed to generate share image",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-6 relative">
      {/* Scanning Overlay */}
      {scanning && uploadedImage && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-8 max-w-md w-full space-y-6">
            <div className="relative">
              <img 
                src={uploadedImage} 
                alt="Analyzing" 
                className="w-full aspect-square object-cover rounded-2xl"
              />
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="scanning-line"></div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-gradient-accent">Scanning Your Style</h3>
              <p className="text-sm text-muted-foreground">Analyzing color, fit, texture, and occasion...</p>
              <div className="flex justify-center gap-2 pt-4">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-accent">Style Check</h2>
        <p className="text-sm text-muted-foreground">
          Proof your outfit in 30 seconds. Honest score. Easy fixes.
        </p>
      </div>

      {/* Upload Area */}
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
        onClick={() => !loading && fileInputRef.current?.click()}
        className="glass-card rounded-2xl p-8 border-2 border-dashed border-border/50 text-center space-y-4 hover:border-accent/50 transition-colors cursor-pointer"
      >
        <div className="mx-auto w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
          <Camera className="w-8 h-8 text-accent" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">
            {loading ? "Processing..." : "Upload Your Outfit"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {loading ? "Analyzing your style..." : "Tap to snap or select from gallery"}
          </p>
        </div>
      </div>

      {/* Score Card */}
      {latestScore && (
        <div className="glass-card rounded-2xl p-6 space-y-4 glow-accent">
          {/* Image with Score Overlay */}
          {latestScore.image_url && (
            <div className="relative rounded-xl overflow-hidden mb-4">
              <img 
                src={latestScore.image_url} 
                alt="Your outfit" 
                className="w-full aspect-square object-cover"
              />
              <div className="absolute top-4 right-4 glass-card px-4 py-2 rounded-full">
                <span className="text-2xl font-bold text-gradient-accent">
                  {latestScore.overall_score.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg mb-1">Latest Check</h3>
              <p className="text-xs text-muted-foreground">
                {new Date(latestScore.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gradient-accent">
                {latestScore.overall_score.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">out of 5.0</p>
            </div>
          </div>

          {/* Subscores */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Color", score: latestScore.color_score },
              { label: "Fit", score: latestScore.fit_score },
              { label: "Texture", score: latestScore.texture_score },
              { label: "Occasion", score: latestScore.occasion_score },
            ].map((item) => (
              <div key={item.label} className="bg-muted/20 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-lg font-bold text-accent">{item.score.toFixed(1)}</p>
              </div>
            ))}
          </div>

          {/* Verdict */}
          <div className="pt-4 border-t border-border/50 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-accent mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-base font-semibold mb-2 text-accent">What's working</p>
                <p className="text-sm text-foreground leading-relaxed">
                  {latestScore.verdict_positive}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-base font-semibold mb-2 text-primary">Quick fixes</p>
                <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                  {latestScore.verdict_improvements}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              className="flex-1 glass-card border-border/50" 
              variant="outline"
              onClick={extractToWardrobe}
              disabled={loading}
            >
              <Upload className="w-4 h-4 mr-2" />
              Add to Wardrobe
            </Button>
            <Button 
              className="flex-1 glow-primary" 
              onClick={handleShare}
              disabled={loading}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StyleCheck;