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
  const [latestScore, setLatestScore] = useState<StyleScore | null>(null);

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

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;

        toast({
          title: "Analyzing outfit...",
          description: "Scoring your style across multiple dimensions...",
        });

        // Score with AI
        const { data, error } = await supabase.functions.invoke('score-outfit', {
          body: { imageData, occasion: null }
        });

        if (error) throw error;

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
    }
  };

  const handleShare = async () => {
    if (!latestScore) return;

    // Create shareable text
    const shareText = `MyMirro Style Score: ${latestScore.overall_score}/5.0\n\n✨ What's Working:\n${latestScore.verdict_positive}\n\n💡 Quick Fixes:\n${latestScore.verdict_improvements}\n\nCheck your style at MyMirro!`;

    if (navigator.share) {
      try {
        await navigator.share({
          text: shareText,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText);
      toast({
        title: "Copied!",
        description: "Score card copied to clipboard",
      });
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-6">
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
          <div className="pt-4 border-t border-border/50 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">What's working</p>
                <p className="text-xs text-muted-foreground">
                  {latestScore.verdict_positive}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Quick fixes</p>
                <div className="text-xs text-muted-foreground whitespace-pre-line">
                  {latestScore.verdict_improvements}
                </div>
              </div>
            </div>
          </div>

          {/* Share Button */}
          <Button 
            className="w-full glass-card border-border/50" 
            variant="outline"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Score Card
          </Button>
        </div>
      )}
    </div>
  );
};

export default StyleCheck;