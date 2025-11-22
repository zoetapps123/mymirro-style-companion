import { Share2 } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAnalytics } from "@/hooks/useAnalytics";

interface ShareOutfitCardProps {
  outfitName: string;
  imageUrl?: string;
  score?: number;
  onShare: () => void;
  outfitId?: string;
}

const ShareOutfitCard = ({ outfitName, imageUrl, score, onShare, outfitId }: ShareOutfitCardProps) => {
  const { toast } = useToast();
  const { trackCustom } = useAnalytics();

  const handleShare = async () => {
    const shareMethod = navigator.canShare?.({ files: [] }) ? 'native_share' : 'download';
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
      gradient.addColorStop(0, '#C66CF6');
      gradient.addColorStop(1, '#FF87D4');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);

      // MyMirro branding
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 80px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MyMirro', 540, 150);

      // Outfit image
      if (imageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = imageUrl;
        });
        
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(240, 250, 600, 900, 40);
        ctx.clip();
        ctx.drawImage(img, 240, 250, 600, 900);
        ctx.restore();
      }

      // Outfit name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 60px sans-serif';
      ctx.fillText(outfitName, 540, 1250);

      // Score if provided
      if (score) {
        ctx.font = 'bold 80px sans-serif';
        ctx.fillText(`${score.toFixed(1)} / 5.0`, 540, 1380);
      }

      // Footer
      ctx.font = '40px sans-serif';
      ctx.fillText('Styled by MyMirro', 540, 1750);
      
      // Call share function
      const shareImage = canvas.toDataURL('image/png');
      const response = await fetch(shareImage);
      const blob = await response.blob();
      const file = new File([blob], 'mymirro-outfit.png', { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ 
          files: [file], 
          title: `${outfitName} - MyMirro`,
          text: 'Check out my outfit styled by MyMirro! ✨'
        });
      } else {
        // Fallback to download
        const link = document.createElement('a');
        link.href = shareImage;
        link.download = 'mymirro-outfit.png';
        link.click();
        toast({ 
          title: "Downloaded!", 
          description: "Share your outfit card on social media" 
        });
      }
      
      // Track share action
      trackCustom('share_outfit', {
        outfit_id: outfitId,
        outfit_name: outfitName,
        has_score: !!score,
        share_method: shareMethod,
      }, 'user_action:share');
      
      onShare();
    } catch (error) {
      console.error('Share error:', error);
      toast({
        title: "Couldn't share",
        description: "Try again in a moment",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      onClick={handleShare}
      className="glow-primary group"
      variant="default"
    >
      <Share2 className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
      Share Outfit
    </Button>
  );
};

export default ShareOutfitCard;
