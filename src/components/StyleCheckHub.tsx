import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CheckCircle, Share2, Package, AlertCircle, Sparkles, Download, Loader2, History as HistoryIcon, Swords } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAnalytics } from "@/hooks/useAnalytics";
import { OutfitCheckOccasionModal } from "./OutfitCheckOccasionModal";

interface StyleCheckHubProps {
  onNavigate: (view: 'outfit-check' | 'outfit-battle') => void;
  onNavigateToBattle?: (outfitData: any) => void;
}

const StyleCheckHub = ({ onNavigate, onNavigateToBattle }: StyleCheckHubProps) => {
  const { trackClick } = useAnalytics();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showOccasionModal, setShowOccasionModal] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState<string>("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
  const [elevating, setElevating] = useState(false);
  const [elevatedImage, setElevatedImage] = useState<string | null>(null);

  // Restore Style Check state for this session
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('style_check_state');
      if (saved) {
        const s = JSON.parse(saved);
        if (typeof s.selectedOccasion === 'string') setSelectedOccasion(s.selectedOccasion);
        if (typeof s.uploadedImage === 'string' || s.uploadedImage === null) setUploadedImage(s.uploadedImage);
        if (s.result) setResult(s.result);
        if (Array.isArray(s.extractedItems)) setExtractedItems(s.extractedItems);
        if (typeof s.extracted === 'boolean') setExtracted(s.extracted);
        if (typeof s.elevatedImage === 'string' || s.elevatedImage === null) setElevatedImage(s.elevatedImage);
      }
    } catch (e) {
      console.warn('Failed to restore style check state', e);
    }
  }, []);

  // Persist while tab is open (clears on session close)
  useEffect(() => {
    const state = { selectedOccasion, uploadedImage, result, extractedItems, extracted, elevatedImage };
    try {
      sessionStorage.setItem('style_check_state', JSON.stringify(state));
    } catch {}
  }, [selectedOccasion, uploadedImage, result, extractedItems, extracted, elevatedImage]);

  useEffect(() => {
    loadWardrobeItems();
  }, []);
  const loadWardrobeItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setWardrobeItems(data || []);
    } catch (error) {
      console.error('Error loading wardrobe:', error);
    }
  };

  const occasions = [
    "Casual Day Out",
    "Office",
    "Date",
    "Party",
    "Wedding",
    "Travel",
    "Interview",
    "Gym",
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setShowOccasionModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const startStyleCheck = async (occasionOverride?: string) => {
    const occasion = occasionOverride || selectedOccasion;
    if (!uploadedImage || !occasion) return;

    setLoading(true);
    setScanning(true);
    setExtracted(false);

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
        body: { imageData: uploadedImage, occasion: occasion },
        headers: { Authorization: `Bearer ${session.access_token}` }
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

      setScanning(false);
      
      // Enhance quick fixes with wardrobe suggestions
      const enhancedQuickFixes = await enhanceQuickFixesWithWardrobe(data.quick_fix || []);
      
      setResult({ ...data, quick_fix: enhancedQuickFixes, image_url: uploadedImage });
      setLoading(false);
      toast({ title: 'Score complete!', description: `${data.outfit_name}: ${data.overall_score.toFixed(1)}/5.0` });

      // Background persistence
      (async () => {
        try {
          const response = await fetch(uploadedImage);
          const blob = await response.blob();
          const fileName = `style-check-${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('outfits')
            .upload(fileName, blob);
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
            verdict_positive: Array.isArray(data.what_works) ? data.what_works.join(' | ') : (data.what_works || data.verdict_positive),
            verdict_improvements: Array.isArray(data.what_didnt_work) ? data.what_didnt_work.join(' | ') : (data.what_didnt_work || data.what_could_be_better || data.verdict_improvements),
            quick_fix: Array.isArray(data.quick_fix) ? data.quick_fix.join(' | ') : (data.quick_fix || ''),
            occasion: occasion
          });

          setResult((prev: any) => prev ? { ...prev, image_url: publicUrl } : prev);
        } catch (persistErr) {
          console.error('Save failed:', persistErr);
        }
      })();
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
      
      const { data: existingItems } = await supabase
        .from('wardrobe_items')
        .select('name, category, color')
        .eq('user_id', user.id);

      const response = await fetch(result.image_url);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        try {
          const imageData = reader.result as string;

          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            console.error('No session found');
            setExtracting(false);
            toast({
              title: "Session expired",
              description: "Please refresh the page and try again",
              variant: "destructive",
            });
            return;
          }

          const { data, error } = await supabase.functions.invoke('process-wardrobe', {
            body: { imageData },
            headers: { Authorization: `Bearer ${session.access_token}` }
          });

          if (error) {
            console.error('Process wardrobe error:', error);
            setExtracting(false);
            toast({
              title: "Processing failed",
              description: error.message || "Failed to process image",
              variant: "destructive",
            });
            return;
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

          for (const item of itemsDetected) {
            const isDuplicate = existingItems?.some(existing => 
              existing.category?.toLowerCase() === item.category?.toLowerCase() &&
              (existing.name?.toLowerCase().includes(item.name?.toLowerCase()) ||
               item.name?.toLowerCase().includes(existing.name?.toLowerCase()) ||
               (existing.color?.toLowerCase() === item.color?.toLowerCase() &&
                Math.abs((existing.name?.length || 0) - (item.name?.length || 0)) < 5))
            );

            if (isDuplicate) {
              skippedCount++;
              continue;
            }

            const fileName = `${Date.now()}-${Math.random()}-${item.name.replace(/\s+/g, '-')}.png`;
          const sourceDataUrl = (item.processedImageUrl as string | undefined) || data?.compositeImageUrl || imageData;
          if (typeof sourceDataUrl !== 'string' || !sourceDataUrl.includes(',')) {
            console.warn('No per-item image; skipping upload for', item?.name || 'unknown');
            skippedCount++;
            continue;
          }
          const base64Data = sourceDataUrl.split(',')[1];
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

            const { error: insertError } = await supabase.from('wardrobe_items').insert({
              user_id: user.id,
              name: item.name,
              category: item.category,
              color: item.color,
              image_url: publicUrl,
              processed_image_url: publicUrl,
            });

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
          setExtracted(true);

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
        } catch (readerError) {
          console.error('Reader error:', readerError);
          setExtracting(false);
          toast({
            title: "Extraction failed",
            description: "An error occurred while processing items",
            variant: "destructive",
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

  const enhanceQuickFixesWithWardrobe = async (quickFixes: string[]): Promise<string[]> => {
    if (!wardrobeItems.length) return quickFixes;

    const relevantItems = wardrobeItems.filter(item => 
      ['Accessories', 'Shoes', 'Outerwear'].includes(item.category)
    );

    if (!relevantItems.length) return quickFixes;

    const wardrobeSuggestion = relevantItems
      .slice(0, 2)
      .map(item => `Add your ${item.category.toLowerCase()}: ${item.name}`)
      .join(' | ');

    return [...quickFixes.slice(0, 4), wardrobeSuggestion, ...quickFixes.slice(4)];
  };

  const elevateWithAI = async () => {
    if (!uploadedImage) return;

    setElevating(true);
    try {
      const quickFixText = result?.quick_fix?.join('. ') || '';

      // Helpers scoped here to keep changes minimal
      const getImageDimensions = (src: string) => new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        img.onerror = reject;
        img.src = src;
      });

      const rotate90 = (src: string) => new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.height;
          canvas.height = img.width;
          const ctx = canvas.getContext('2d')!;
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = src;
      });

      const ensureMatchingOrientation = async (originalUrl: string, enhancedUrl: string) => {
        try {
          const [o, e] = await Promise.all([getImageDimensions(originalUrl), getImageDimensions(enhancedUrl)]);
          const origPortrait = o.height >= o.width;
          const enhPortrait = e.height >= e.width;
          if (origPortrait !== enhPortrait) {
            // Rotate enhanced to match original orientation
            return await rotate90(enhancedUrl);
          }
          return enhancedUrl;
        } catch {
          return enhancedUrl;
        }
      };

      // Compute original orientation and dimensions to guide the model
      const { width, height } = await getImageDimensions(uploadedImage);
      const orientation = width >= height ? 'landscape' : 'portrait';

      // Prepare wardrobe items for AI to use
      const wardrobeItemsList = wardrobeItems.map(item => ({
        name: item.name,
        category: item.category,
        color: item.color
      }));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase.functions.invoke('elevate-style', {
        body: {
          imageData: uploadedImage,
          improvements: quickFixText,
          wardrobeItems: wardrobeItemsList,
          orientation,
          width,
          height,
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) throw error;

      if (data?.enhancedImage) {
        const fixed = await ensureMatchingOrientation(uploadedImage, data.enhancedImage);
        setElevatedImage(fixed);
        toast({ title: 'AI styling complete!', description: 'Check out your elevated look' });
      } else {
        throw new Error('No image returned');
      }
    } catch (error: any) {
      console.error('Error elevating style:', error);
      toast({ title: 'Failed to elevate style', description: error.message || 'Please try again', variant: 'destructive' });
    } finally {
      setElevating(false);
    }
  };

  const downloadImage = (imageData: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = filename;
    link.click();
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

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = result.image_url;
    });
    
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

    ctx.fillStyle = 'hsl(295, 75%, 58%)';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MyMirro', 540, 1080);

    ctx.fillStyle = 'hsl(240, 5%, 98%)';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(result.outfit_name, 540, 1150);

    ctx.font = 'bold 120px sans-serif';
    ctx.fillText(`${result.overall_score.toFixed(1)}`, 540, 1300);
    ctx.font = '32px sans-serif';
    ctx.fillStyle = 'hsl(240, 5%, 70%)';
    ctx.fillText('out of 5.0', 540, 1350);

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
  };

  const canStartCheck = uploadedImage && selectedOccasion;

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <OutfitCheckOccasionModal
        open={showOccasionModal}
        onSelect={async (occasion) => {
          setSelectedOccasion(occasion);
          setShowOccasionModal(false);
          await startStyleCheck(occasion);
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
      
      <div className="p-4 space-y-6">
        {/* Title with History Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-primary">Style Check</h1>
            <p className="text-muted-foreground mt-1 text-base">
              Pro score and quick fixes for your look
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/history')}
            className="gap-2 flex-shrink-0"
          >
            <HistoryIcon className="w-4 h-4" />
            History
          </Button>
        </div>


        {/* Upload Image */}
        {!result && (
          <div>
            <label htmlFor="outfit-upload">
              <div className="bg-muted/30 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors min-h-[280px]">
                {uploadedImage ? (
                  <img
                    src={uploadedImage}
                    alt="Uploaded outfit"
                    className="max-h-64 rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <Camera className="w-16 h-16 text-primary" strokeWidth={1.5} />
                    <div className="text-center">
                      <p className="font-semibold text-lg">Upload an Image</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Choose where you're heading above
                      </p>
                    </div>
                  </>
                )}
              </div>
            </label>
            <input
              id="outfit-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            
            {/* Start Check Button - Right below image */}
            {canStartCheck && (
              <Button
                className="w-full h-12 text-lg rounded-full mt-4"
                onClick={() => startStyleCheck()}
                disabled={loading}
              >
                Start Style Check
              </Button>
            )}
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-card rounded-2xl p-6 space-y-4">
              {/* Image Comparison - Show side by side if AI is processing or done */}
              {(elevating || elevatedImage) ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-center text-muted-foreground">Original</p>
                    <div className="relative">
                      <img
                        src={result.image_url}
                        alt="Original outfit"
                        className="w-full aspect-square object-cover rounded-xl border-2 border-border"
                      />
                      <Button
                        variant="default"
                        size="sm"
                        className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-primary/70 backdrop-blur-md hover:bg-primary/80 rounded-full shadow-lg text-xs"
                        onClick={extractToWardrobe}
                        disabled={extracting}
                      >
                        <Package className="w-3 h-3 mr-1" />
                        {extracting ? 'Extracting...' : 'Extract'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-center text-accent">AI Enhanced ✨</p>
                    <div className="relative w-full aspect-square rounded-xl border-2 border-accent overflow-hidden">
                      {elevating ? (
                        <div className="absolute inset-0 bg-muted/30 backdrop-blur-sm flex flex-col items-center justify-center">
                          <Loader2 className="w-8 h-8 text-accent animate-spin mb-2" />
                          <p className="text-xs text-muted-foreground">Processing...</p>
                        </div>
                      ) : elevatedImage ? (
                        <img
                          src={elevatedImage}
                          alt="AI enhanced outfit"
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <img src={result.image_url} alt="Checked outfit" className="w-full aspect-square object-cover rounded-xl" />
                  
                  <Button
                    variant="default"
                    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-primary/70 backdrop-blur-md hover:bg-primary/80 rounded-full shadow-lg"
                    onClick={extractToWardrobe}
                    disabled={extracting || extracted}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {extracted ? 'Added' : extracting ? 'Extracting...' : 'Extract to Wardrobe'}
                  </Button>
                </div>
              )}

              {/* Scores and Name */}
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-primary">{result.outfit_name}</h3>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-5xl font-bold text-accent">{result.overall_score.toFixed(1)}</span>
                  <span className="text-muted-foreground">/ 5.0</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Color</p>
                  <p className="text-xl font-bold text-accent">{result.color_score.toFixed(1)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Fit</p>
                  <p className="text-xl font-bold text-accent">{result.fit_score.toFixed(1)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Texture</p>
                  <p className="text-xl font-bold text-accent">{result.texture_score.toFixed(1)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Occasion</p>
                  <p className="text-xl font-bold text-accent">{result.occasion_score.toFixed(1)}</p>
                </div>
              </div>

              {/* Elevate Through AI button - RIGHT AFTER SCORES */}
              <Button
                variant="default"
                className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                onClick={elevateWithAI}
                disabled={elevating || elevatedImage !== null}
              >
                {elevating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    AI is Working Magic...
                  </>
                ) : elevatedImage ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    AI Enhanced
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Elevate Through AI
                  </>
                )}
              </Button>

              {/* Download/Share buttons for AI enhanced image */}
              {elevatedImage && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full"
                    onClick={() => downloadImage(elevatedImage, 'ai-enhanced-style.png')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full"
                    onClick={handleShare}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              )}

              {/* What Works, Doesn't Work, Quick Fixes - ALWAYS VISIBLE */}
              <div className="space-y-3">
                <div className="bg-[#43B581]/10 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-[#43B581] flex-shrink-0 mt-0.5" />
                    <div className="w-full">
                      <p className="font-semibold text-[#43B581] mb-2">What Works</p>
                      <ul className="space-y-1">
                        {(Array.isArray(result.what_works) ? result.what_works : [result.what_works || result.verdict_positive]).map((item: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start">
                            <span className="mr-2 text-[#43B581]">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {(result.what_didnt_work || result.what_could_be_better || result.verdict_improvements) && (
                  <div className="bg-[#E26D6D]/10 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-[#E26D6D] flex-shrink-0 mt-0.5" />
                      <div className="w-full">
                        <p className="font-semibold text-[#E26D6D] mb-2">What Doesn't Work</p>
                        <ul className="space-y-1">
                          {(Array.isArray(result.what_didnt_work) ? result.what_didnt_work : [result.what_didnt_work || result.what_could_be_better || result.verdict_improvements]).map((item: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start">
                              <span className="mr-2 text-[#E26D6D]">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {result.quick_fix && (
                  <div className="bg-blue-500/10 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="w-full">
                        <p className="font-semibold text-blue-500 mb-2">Quick Fixes (Under 1 Minute)</p>
                        <ul className="space-y-1">
                          {(Array.isArray(result.quick_fix) ? result.quick_fix : [result.quick_fix]).map((item: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start">
                              <span className="mr-2">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {extractedItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Extracted Items:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {extractedItems.map((item, idx) => (
                      <div key={idx} className="bg-muted/30 rounded-lg p-2">
                        <img src={item.image_url} alt={item.name} className="w-full aspect-square object-cover rounded-lg mb-1" />
                        <p className="text-xs font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  setResult(null);
                  setUploadedImage(null);
                  setExtractedItems([]);
                  setExtracted(false);
                  setElevatedImage(null);
                }}
              >
                Check Another Outfit
              </Button>

              {/* Battle Button CTA - appears after style check */}
              {onNavigateToBattle && (
                <div className="glass-card rounded-2xl p-4 border-2 border-accent/30 bg-gradient-to-r from-accent/10 to-primary/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                        <Swords className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold">Ready to compete?</h4>
                        <p className="text-sm text-muted-foreground">Take it to an Outfit Battle</p>
                      </div>
                    </div>
                    <Button onClick={handleBattleNavigation} size="sm" className="min-h-[40px]">
                      Battle →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Battle of the fits */}
        {!result && (
          <div>
            <h2 className="text-xl font-semibold text-primary mb-3">
              Battle of the fits
            </h2>
            <Card
              className="p-6 cursor-pointer hover:border-primary transition-colors relative overflow-hidden border-2 border-primary rounded-2xl"
          onClick={() => {
            trackClick('style_check_button', 'outfit-battle', { feature: 'outfit_battle' });
            onNavigate('outfit-battle');
          }}
            >
              <div className="absolute top-4 right-6 opacity-30">
                <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
                  <text
                    x="0"
                    y="70"
                    fill="currentColor"
                    className="text-primary"
                    style={{
                      fontSize: "72px",
                      fontWeight: "bold",
                      fontFamily: "system-ui, -apple-system, sans-serif",
                    }}
                  >
                    VS
                  </text>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-primary mb-2">
                Outfit Battle
              </h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Upload, compare, and crown the best outfit.
              </p>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full">
                Lets Fight!
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default StyleCheckHub;
