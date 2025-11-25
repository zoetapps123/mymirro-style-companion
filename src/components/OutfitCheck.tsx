import { Upload, CheckCircle, Share2, Camera, Package, Shirt, AlertCircle, Sparkles, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { OutfitCheckOccasionModal } from "./OutfitCheckOccasionModal";
import { useAnalytics } from "@/hooks/useAnalytics";
import { trackPageView } from "@/lib/mixpanel";
import { SCREEN_NAMES, SCREEN_PATHS } from "@/lib/screenRoutes";

interface OutfitCheckProps {
  onBack: () => void;
  onNavigateToBattle?: (outfitData: any) => void;
}

const occasions = ["Casual Day Out", "Office", "Dinner Date", "Party", "Wedding", "Travel", "Interview"];

const OutfitCheck = ({ onBack, onNavigateToBattle }: OutfitCheckProps) => {
  const { trackCustom, startFlow, trackFlowStep, completeFlow, trackScreenView } = useAnalytics();
  const uploadAttempts = useRef(0);
  const uploadStartTime = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [showOccasionModal, setShowOccasionModal] = useState(false);
  const styleCheckStartTime = useRef<number>(0);

  // Track screen view on mount with standardized naming
  useEffect(() => {
    trackScreenView(
      'stylecheck-check',
      { context: 'style_check' },
      '/app/stylecheck/check'
    );
  }, [trackScreenView]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    uploadAttempts.current++;
    uploadStartTime.current = Date.now();
    styleCheckStartTime.current = Date.now();
      
    trackCustom('upload_attempt', {
      attempt_number: uploadAttempts.current,
      file_type: file.type,
      file_size_bytes: file.size,
      context: 'style_check',
    }, 'Style Check - Upload Attempt', '/app/stylecheck/outfit-check');

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result as string);
      setShowOccasionModal(true);
    };
    reader.readAsDataURL(file);
  };

  const extractToWardrobe = async () => {
    if (!result?.image_url) return;
    
    setExtracting(true);
    setExtractedItems([]);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to add items to wardrobe",
          variant: "destructive",
        });
        return;
      }
      
        // Fetch existing wardrobe items for duplicate checking (include primary_color and brand)
        const { data: existingItems } = await supabase
          .from('wardrobe_items')
          .select('name, category, color, primary_color, brand')
          .eq('user_id', user.id);

      const response = await fetch(result.image_url);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const imageData = reader.result as string;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.error('No session found');
          return;
        }

        const { data, error } = await supabase.functions.invoke('process-wardrobe', {
          body: { imageData },
          headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (error) {
          console.error('Process wardrobe error:', error);
          throw new Error('Failed to process image');
        }

        const itemsDetected = data?.items || [];
        if (itemsDetected.length === 0) {
          toast({
            title: "No items detected",
            description: "Try a clearer photo with visible clothing items.",
            variant: "destructive",
          });
          setExtracting(false);
          return;
        }

        let addedCount = 0;
        let skippedCount = 0;
        const addedItemsPreview: any[] = [];
        const { isLikelyDuplicateWardrobeItem } = await import('@/lib/wardrobeDeduplication');

        for (const item of itemsDetected) {
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
            console.log(`Skipping duplicate item: ${item.name} [${duplicateReason}]`);
            skippedCount++;
            continue;
          }

          const fileName = `${Date.now()}-${Math.random()}-${item.name.replace(/\s+/g, '-')}.png`;
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

          const { mapDetectedItemToDbRecord } = await import('@/lib/wardrobeItemMapper');
          const { data: insertedRows, error: insertError } = await supabase.from('wardrobe_items').insert([
            mapDetectedItemToDbRecord(item, user.id, publicUrl, publicUrl)
          ]).select('*');

          if (!insertError) {
            addedCount++;
            addedItemsPreview.push({
              name: item.name,
              category: item.category,
              image_url: publicUrl,
            });
          }
        }

        setExtractedItems(addedItemsPreview);
        setExtracting(false);

        if (addedCount > 0) {
          toast({
            title: "Added to wardrobe!",
            description: `${addedCount} item${addedCount > 1 ? 's' : ''} extracted${skippedCount > 0 ? ` (${skippedCount} duplicate${skippedCount > 1 ? 's' : ''} skipped)` : ''}.`,
          });
        } else {
          toast({
            title: "All items already in wardrobe",
            description: `${skippedCount} duplicate${skippedCount > 1 ? 's' : ''} skipped to save credits.`,
          });
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Extract error:', error);
      setExtracting(false);
      toast({
        title: "Extraction failed",
        description: "Couldn't extract items. Please retry.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (!result) return;
    
    const shareMethod = navigator.canShare?.({ files: [] }) ? 'native_share' : 'download';

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
    const whatWorksText = Array.isArray(result.what_works) 
      ? result.what_works.join(' • ') 
      : (result.what_works || result.verdict_positive || '');
    ctx.fillStyle = 'hsl(180, 65%, 45%)';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    const words = whatWorksText.split(' ');
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
    
    // Track share action
    trackCustom('share_style_check', {
      occasion: selectedOccasion,
      score: result.overall_score,
      share_method: shareMethod,
    }, 'Style Check - Shared', '/app/stylecheck/outfit-check');
  };

  const handleBattleNavigation = () => {
    if (onNavigateToBattle && result) {
      onNavigateToBattle({
        imageData: result.image_url,
        occasion: selectedOccasion,
        score: result.overall_score,
        name: result.outfit_name
      });
    }
  };

  return (
    <div className="flex flex-col h-full p-3 sm:p-4 space-y-3 sm:space-y-4 pb-safe">
      <OutfitCheckOccasionModal
        open={showOccasionModal}
        onSelect={async (occasion) => {
          setSelectedOccasion(occasion);
          setShowOccasionModal(false);
          
          // Track occasion selection
          trackCustom('style_check_occasion_selected', {
            occasion: occasion,
          }, `Style Check - ${occasion}`, '/app/stylecheck/outfit-check');
          
          // Track style check submit
          trackCustom('style_check_submit', {
            occasion: occasion,
            file_size_kb: uploadedImage ? Math.round(uploadedImage.length / 1024) : 0,
          }, 'Style Check - Submit', '/app/stylecheck/outfit-check');

          // Start check immediately after occasion selection
          if (uploadedImage) {
            setLoading(true);
            setScanning(true);
            
            try {
              const { data: { session }, error: sessionError } = await supabase.auth.getSession();
              
              if (sessionError || !session?.user) {
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
              await new Promise(resolve => setTimeout(resolve, 2000));

              const { data, error } = await supabase.functions.invoke('score-outfit', {
                body: { imageData: uploadedImage, occasion },
                headers: { Authorization: `Bearer ${session.access_token}` }
              });

              if (error) {
                console.error('Score outfit error:', error);
                const status = (error as any)?.context?.response?.status;
                setScanning(false);
                setLoading(false);
                
                if (status === 429) {
                  toast({ 
                    title: 'High demand', 
                    description: 'Our AI is experiencing high traffic. Please wait a moment and try again.', 
                    variant: 'destructive' 
                  });
                } else if (status === 402) {
                  toast({ title: 'Service unavailable', description: 'Please try again later.', variant: 'destructive' });
                } else {
                  toast({ title: 'Scoring failed', description: `Unable to analyze outfit.`, variant: 'destructive' });
                }
                return;
              }

              if (!data) {
                setScanning(false);
                setLoading(false);
                toast({ title: 'Error', description: 'No response from server. Try again.', variant: 'destructive' });
                return;
              }

              setScanning(false);
              setResult({ ...data, image_url: uploadedImage });
              setLoading(false);
              
              const processingTime = Date.now() - styleCheckStartTime.current;
              
              // Track successful style check
              trackCustom('style_check_completed', {
                occasion: occasion,
                overall_score: data.overall_score,
                outfit_name: data.outfit_name,
                processing_time_ms: processingTime,
              }, `Style Check - Completed (${occasion})`, '/app/stylecheck/outfit-check');

              toast({ title: 'Score complete!', description: `${data.outfit_name}: ${data.overall_score.toFixed(1)}/5.0` });
            } catch (error) {
              console.error('Error:', error);
              
              // Track style check error
              trackCustom('style_check_error', {
                occasion: occasion,
                error_message: error instanceof Error ? error.message : 'Unknown error',
              }, 'Style Check - Error', '/app/stylecheck/outfit-check');

              toast({
                title: "Error",
                description: "Failed to analyze outfit",
                variant: "destructive",
              });
              setScanning(false);
              setLoading(false);
            }
          }
        }}
        onClose={() => {
          setShowOccasionModal(false);
          setUploadedImage(null);
        }}
      />
      
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  setUploadedImage(reader.result as string);
                  setShowOccasionModal(true);
                };
                reader.readAsDataURL(e.target.files[0]);
              }
            }}
            className="hidden"
            disabled={loading}
          />
          <div 
            onClick={() => {
              if (!loading) fileInputRef.current?.click();
            }}
            className="glass-card rounded-2xl p-6 sm:p-8 border-2 border-dashed text-center space-y-3 sm:space-y-4 transition-all active:scale-[0.98] border-accent/50 hover:border-accent cursor-pointer"
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
            </div>

            <div className="text-center space-y-3">
              <h3 className="text-xl sm:text-2xl font-bold text-gradient-primary">{result.outfit_name}</h3>
              
              <div className="glass-card rounded-2xl p-6 space-y-2">
                <p className="text-sm sm:text-base text-muted-foreground font-medium">Overall Score</p>
                <div className="text-5xl sm:text-6xl font-bold text-gradient-accent">
                  {result.overall_score.toFixed(1)}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">out of 5.0</p>
              </div>
            </div>

            {/* Extract Items CTA */}
            {extractedItems.length === 0 && (
              <Button 
                variant="default" 
                className="w-full min-h-[52px] text-sm font-semibold"
                onClick={extractToWardrobe}
                disabled={extracting}
              >
                {extracting ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent" />
                      <span>Clipping garments</span>
                      <span className="animate-pulse">✂️</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Shirt className="w-4 h-4 mr-2" />
                    Extract Items & Add to Wardrobe
                  </>
                )}
              </Button>
            )}

            {/* Extracted Items Preview */}
            {extractedItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-accent">Extracted Items</h4>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {extractedItems.map((item, idx) => (
                    <div key={idx} className="flex-shrink-0 w-20 space-y-1">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted/20">
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0.5 w-full justify-center truncate">
                        {item.category}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-wardrobe'))}
                >
                  <Package className="w-3 h-3 mr-1" />
                  View in Wardrobe
                </Button>
              </div>
            )}

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
              {/* What Works - Green Highlight */}
              <div className="space-y-2 bg-[#43B581]/10 rounded-xl p-3">
                <div className="flex items-center gap-2 pb-1 border-b border-[#43B581]/20">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#43B581]" />
                  <h4 className="text-sm sm:text-base font-semibold text-[#43B581]">What Works</h4>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {(Array.isArray(result.what_works) 
                    ? result.what_works 
                    : [result.what_works || result.verdict_positive || "Overall, your outfit has strong elements."]
                  ).map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                      <span className="text-[#43B581] mt-0.5">✓</span>
                      <span className="leading-relaxed text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* What Didn't Work - Red Highlight */}
              <div className="space-y-2 bg-[#E26D6D]/10 rounded-xl p-3">
                <div className="flex items-center gap-2 pb-1 border-b border-[#E26D6D]/20">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#E26D6D]" />
                  <h4 className="text-sm sm:text-base font-semibold text-[#E26D6D]">What Doesn't Work</h4>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {(Array.isArray(result.what_doesnt_work) 
                    ? result.what_doesnt_work 
                    : [result.what_doesnt_work || result.what_could_be_better || result.verdict_improvements || "A few tweaks could elevate this look further."]
                  ).map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                      <span className="text-[#E26D6D] mt-0.5">⚠</span>
                      <span className="leading-relaxed text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Quick Fix */}
              {(result.quick_fix || result.quick_fixes) && (
                <div className="space-y-2 glass-card rounded-xl p-3 border border-accent/20">
                  <div className="flex items-center gap-2 pb-1 border-b border-accent/20">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                    <h4 className="text-sm sm:text-base font-semibold text-gradient-accent">Quick Fix</h4>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    {(() => {
                      // Priority 1: quick_fixes array (new format from unified prompt)
                      if (Array.isArray(result.quick_fixes) && result.quick_fixes.length > 0) {
                        return result.quick_fixes;
                      }
                      // Priority 2: quick_fix string split by " | " (legacy format)
                      if (typeof result.quick_fix === 'string' && result.quick_fix) {
                        return result.quick_fix.split(' | ').filter(Boolean);
                      }
                      // Fallback
                      return ["Consider minor adjustments for better cohesion"];
                    })().map((item: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                        <span className="text-accent mt-0.5">✨</span>
                        <span className="leading-relaxed font-medium text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="min-h-[44px] text-sm" onClick={onBack}>
                Back / Home
              </Button>
              <Button variant="outline" className="min-h-[44px] text-sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
            <Button variant="default" className="w-full min-h-[44px] text-sm" onClick={() => {
              setResult(null);
              setUploadedImage(null);
              setSelectedOccasion(null);
            }}>
              Check Another
            </Button>
          </div>

          {/* Battle Banner CTA */}
          {onNavigateToBattle && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-card rounded-2xl p-4 border-2 border-accent/30 bg-gradient-to-r from-accent/10 to-primary/10"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <Swords className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Ready to compete?</h4>
                    <p className="text-xs text-muted-foreground">Take it to an Outfit Battle</p>
                  </div>
                </div>
                <Button onClick={handleBattleNavigation} size="sm" className="min-h-[36px]">
                  Battle →
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default OutfitCheck;
