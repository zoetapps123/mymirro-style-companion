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
import { VibePredictionSheet } from "./VibePredictionSheet";
import { OccasionVibeSelector } from "./OccasionVibeSelector";
import AnalysisLoader from "./AnalysisLoader";
import { motion } from "framer-motion";

interface StyleCheckHubProps {
  onNavigate: (view: 'outfit-check' | 'outfit-battle') => void;
  onNavigateToBattle?: (outfitData: any) => void;
}

const StyleCheckHub = ({ onNavigate, onNavigateToBattle }: StyleCheckHubProps) => {
  const { trackClick, trackCustom } = useAnalytics();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showOccasionModal, setShowOccasionModal] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState<string>("");
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [selectedVibe, setSelectedVibe] = useState<string>("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);
  const [showPredictionSheet, setShowPredictionSheet] = useState(false);
  const [showOccasionSelector, setShowOccasionSelector] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [extractedItems, setExtractedItems] = useState<any[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
  const [elevating, setElevating] = useState(false);
  const [elevatedImage, setElevatedImage] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore Style Check state from localStorage or database
  useEffect(() => {
    const restoreState = async () => {
      if (restored) return;
      
      try {
        // First try localStorage
        const saved = localStorage.getItem('style_check_state');
        if (saved) {
          const s = JSON.parse(saved);
          if (typeof s.selectedOccasion === 'string') setSelectedOccasion(s.selectedOccasion);
          if (typeof s.selectedStyle === 'string') setSelectedStyle(s.selectedStyle);
          if (typeof s.selectedVibe === 'string') setSelectedVibe(s.selectedVibe);
          if (typeof s.uploadedImage === 'string' || s.uploadedImage === null) setUploadedImage(s.uploadedImage);
          if (s.result) setResult(s.result);
          if (Array.isArray(s.extractedItems)) setExtractedItems(s.extractedItems);
          if (typeof s.extracted === 'boolean') setExtracted(s.extracted);
          if (typeof s.elevatedImage === 'string' || s.elevatedImage === null) setElevatedImage(s.elevatedImage);
          setRestored(true);
          return;
        }

        // Fallback to database - fetch latest style check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setRestored(true);
          return;
        }

        const { data: latestCheck, error } = await supabase
          .from('style_checks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && latestCheck) {
          setUploadedImage(latestCheck.image_url);
          setSelectedOccasion(latestCheck.occasion || '');
          setResult({
            overall_score: latestCheck.overall_score,
            color_score: latestCheck.color_score,
            fit_score: latestCheck.fit_score,
            texture_score: latestCheck.texture_score,
            occasion_score: latestCheck.occasion_score,
            verdict_positive: latestCheck.verdict_positive,
            verdict_improvements: latestCheck.verdict_improvements,
            quick_fix: latestCheck.quick_fix,
            outfit_name: latestCheck.outfit_name
          });
          setExtracted(true);
        }
      } catch (e) {
        console.warn('Failed to restore style check state', e);
      } finally {
        setRestored(true);
      }
    };

    restoreState();
  }, [restored]);

  // Persist to localStorage (survives page refresh and navigation)
  useEffect(() => {
    if (!restored) return; // Don't persist until we've restored once
    
    const state = { selectedOccasion, selectedStyle, selectedVibe, uploadedImage, result, extractedItems, extracted, elevatedImage };
    try {
      localStorage.setItem('style_check_state', JSON.stringify(state));
    } catch {}
  }, [selectedOccasion, selectedStyle, selectedVibe, uploadedImage, result, extractedItems, extracted, elevatedImage, restored]);

  useEffect(() => {
    loadWardrobeItems();
  }, []);
  // Wardrobe Data Loading
  // Fetches user's wardrobe items from Supabase for quick fix enhancement
  // Used to suggest relevant items from user's existing wardrobe
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Track upload attempt
      trackCustom('style_check_image_selected', {
        file_size: file.size,
        file_type: file.type,
      }, 'stylecheck:image_upload', '/app/stylecheck');
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;
        setUploadedImage(imageData);
        setPredicting(true);
        
        // Predict vibe with Gemini
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const { data, error } = await supabase.functions.invoke('predict-outfit-vibe', {
            body: { imageData },
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
          });

          if (error) throw error;
          
          setPrediction(data);
          setSelectedOccasion(data.occasion);
          setSelectedStyle(data.style);
          setSelectedVibe(data.vibe);
          setShowPredictionSheet(true);
        } catch (error) {
          console.error('Prediction error:', error);
          toast({
            title: "Couldn't predict vibe",
            description: "No worries, let's choose manually",
          });
          setShowOccasionModal(true);
        } finally {
          setPredicting(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePredictionConfirm = () => {
    setShowPredictionSheet(false);
    startStyleCheck();
  };

  const handlePredictionEdit = () => {
    setShowPredictionSheet(false);
    setShowOccasionSelector(true);
  };

  const handleOccasionVibeApply = (occasion: string, style: string, vibe: string) => {
    setSelectedOccasion(occasion);
    setSelectedStyle(style);
    setSelectedVibe(vibe);
    setPrediction({
      ...prediction,
      occasion,
      style,
      vibe,
      comment: `Looks ${vibe.toLowerCase()}, perfect for ${occasion.toLowerCase()}!`
    });
    setShowOccasionSelector(false);
    startStyleCheck();
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
        body: { 
          imageData: uploadedImage, 
          occasion: occasion, 
          style: selectedStyle, 
          vibe: selectedVibe,
          wardrobeItems: wardrobeItems
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) {
        console.error('Score outfit error:', error);
        const status = (error as any)?.context?.response?.status;
        const errorMessage = (error as any)?.message || 'Unknown error';
        setScanning(false);
        setLoading(false);
        
        if (status === 429) {
          toast({ 
            title: 'High demand', 
            description: 'Our AI is experiencing high traffic. Please wait a moment and try again.', 
            variant: 'destructive' 
          });
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

  /**
   * Wardrobe Extraction
   * 
   * Detects clothing items in the analyzed outfit image and adds them to user's wardrobe.
   * 
   * API Call: process-wardrobe
   * - Input: { imageData, userId }
   * - Output: { items: Array<{ name, category, image_url, ... }> }
   * - Internally uses WARDROBE_PROMPTS.DETECT_ITEMS for comprehensive metadata extraction
   * 
   * Processing:
   * - Checks for duplicate items (by name) before inserting
   * - Inserts non-duplicate items into wardrobe_items table
   * - Updates UI state to disable extraction button after completion
   */
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
        body: { imageUrl: result.image_url },
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
        const sourceDataUrl = (item.processedImageUrl as string | undefined) || data?.compositeImageUrl || result.image_url;
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

  /**
   * AI Style Elevation
   * 
   * Generates an AI-enhanced version of the outfit that maintains style while
   * addressing identified issues from the style check.
   * 
   * API Call: elevate-style
   * - Input: { imageData, occasion, style, vibe, analysisResult }
   * - Output: { elevatedImageUrl }
   * - Uses STYLING_PROMPTS.QUICK_STYLE_FIXES
   * 
   * Image Processing:
   * - Detects orientation of original image
   * - Matches orientation in enhanced version
   * - Handles both portrait and landscape formats
   */
  /**
   * Phase 8: "Elevate Through AI" - Upgraded to Unified Schema
   * 
   * Now uses comprehensive metadata from style check including:
   * - micro_recommendations (Phase 6 wardrobe-first suggestions)
   * - quick_fix (traditional improvements)
   * - what_doesnt_work / what_didnt_work (issues to address)
   * - missing_features (visibility limitations)
   * 
   * Backend (elevate-style) handles body visibility awareness and builds
   * rich context for AI image generation while maintaining full backward
   * compatibility with legacy payload structure.
   * 
   * Flow:
   * 1. buildImprovementsFromSchema: Combines all feedback sources
   * 2. Deduplicate and prioritize improvements
   * 3. Pass enriched metadata to elevate-style edge function
   * 4. AI generates enhanced image using unified schema context
   * 5. Orientation correction ensures portrait/landscape match
   */
  const elevateWithAI = async () => {
    if (!uploadedImage) return;

    setElevating(true);
    try {
      // Phase 8: Build improvements from unified schema fields
      const improvements = buildImprovementsFromSchema(result);

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

      // Phase 8: Pass enriched payload to elevate-style
      const { data, error } = await supabase.functions.invoke('elevate-style', {
        body: {
          imageData: uploadedImage,
          improvements, // Phase 8: Rich improvements from unified schema
          wardrobeItems: wardrobeItemsList,
          orientation,
          width,
          height,
          // Phase 8: Pass additional metadata (with fallbacks for backward compatibility)
          microRecommendations: result?.micro_recommendations || [],
          missingFeatures: result?.missing_features || [],
          whatDoesntWork: result?.what_didnt_work || result?.what_doesnt_work || [],
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

  /**
   * Phase 8: Helper to build comprehensive improvements from unified schema
   * Combines all available feedback sources with deduplication
   */
  const buildImprovementsFromSchema = (result: any): string => {
    if (!result) return '';

    const improvementSet = new Set<string>();
    
    // Priority 1: Micro-recommendations (Phase 6 - most actionable)
    if (Array.isArray(result.micro_recommendations)) {
      result.micro_recommendations.forEach((item: string) => {
        if (item && typeof item === 'string') improvementSet.add(item.trim());
      });
    }
    
    // Priority 2: Quick fixes (traditional)
    if (Array.isArray(result.quick_fix)) {
      result.quick_fix.forEach((item: string) => {
        if (item && typeof item === 'string') improvementSet.add(item.trim());
      });
    }
    
    // Priority 3: What doesn't work (convert to actionable)
    const whatDoesntWork = result.what_didnt_work || result.what_doesnt_work;
    if (Array.isArray(whatDoesntWork)) {
      whatDoesntWork.forEach((item: string) => {
        if (item && typeof item === 'string') {
          // Convert issue to action if not already actionable
          const trimmed = item.trim();
          if (!trimmed.toLowerCase().startsWith('try') && 
              !trimmed.toLowerCase().startsWith('add') &&
              !trimmed.toLowerCase().startsWith('swap')) {
            improvementSet.add(`Address: ${trimmed}`);
          } else {
            improvementSet.add(trimmed);
          }
        }
      });
    }
    
    // Convert set to array, limit to most important items
    const improvements = Array.from(improvementSet).slice(0, 8);
    
    // Join with period separator for clear instruction format
    return improvements.join('. ') + (improvements.length > 0 ? '.' : '');
  };

  const downloadImage = (imageData: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = filename;
    link.click();
  };

  /**
   * Battle Navigation
   * Navigates to outfit battle feature with current outfit data
   */
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

  /**
   * Share Functionality
   * Generates shareable image of style check results and uses Web Share API
   * Falls back to direct download if sharing is not supported
   */
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

      <VibePredictionSheet
        isOpen={showPredictionSheet}
        prediction={prediction}
        onConfirm={handlePredictionConfirm}
        onEdit={handlePredictionEdit}
        onClose={() => setShowPredictionSheet(false)}
      />

      <OccasionVibeSelector
        isOpen={showOccasionSelector}
        currentOccasion={selectedOccasion}
        currentStyle={selectedStyle}
        currentVibe={selectedVibe}
        onApply={handleOccasionVibeApply}
        onClose={() => setShowOccasionSelector(false)}
      />

      <AnalysisLoader
        isVisible={scanning}
        processingImage={uploadedImage || undefined}
        occasion={`Analyzing fit for your ${selectedOccasion?.toLowerCase()} ${selectedVibe?.toLowerCase()} look 🌞`}
        message="Nice pick 👕 Analyzing your fit..."
      />
      
      {predicting && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-3xl p-8 max-w-md w-full space-y-6 text-center"
          >
            {uploadedImage && (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="relative w-48 h-64 mx-auto"
              >
                <img
                  src={uploadedImage}
                  alt="Analyzing"
                  className="w-full h-full object-cover rounded-2xl"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-primary/30 to-transparent" />
              </motion.div>
            )}
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gradient-accent">
                Detecting your outfit's vibe 👀
              </h3>
              <p className="text-sm text-muted-foreground">
                AI is analyzing your style...
              </p>
            </div>
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      )}
      
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto w-full">
        {!result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Hero Section */}
            <div className="text-center space-y-3">
              <h1 className="text-4xl sm:text-5xl font-bold text-primary">
                Style Check
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto">
                Upload your outfit, get AI-powered style insights in seconds ✨
              </p>
            </div>

            {/* Upload Card */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <label htmlFor="outfit-upload">
                <Card className="cursor-pointer border-2 border-dashed border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden">
                  {uploadedImage ? (
                    <div className="relative aspect-[4/5] sm:aspect-video">
                      <img
                        src={uploadedImage}
                        alt="Your outfit"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-white font-semibold text-lg">
                          Looking good! Let's check your style 👀
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 p-12 sm:p-20 min-h-[320px]">
                      <motion.div
                        animate={{
                          y: [0, -10, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <Camera className="w-16 h-16 text-primary" strokeWidth={1.5} />
                      </motion.div>
                      <div className="text-center space-y-2">
                        <p className="font-semibold text-xl text-foreground">
                          Upload Your Outfit
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Drag & drop or tap to choose
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              </label>
              <input
                id="outfit-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={predicting || scanning}
              />
            </motion.div>

            {/* History Button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => navigate('/history')}
                className="gap-2"
              >
                <HistoryIcon className="w-4 h-4" />
                View History
              </Button>
            </div>
          </motion.div>
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

              {/* Share Result button */}
              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={handleShare}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share Result
              </Button>

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
                          {(Array.isArray(result.what_doesnt_work) ? result.what_doesnt_work : [result.what_doesnt_work || result.what_could_be_better || result.verdict_improvements]).map((item: string, idx: number) => (
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

                {(result.quick_fix || result.quick_fixes) && (
                  <div className="bg-blue-500/10 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="w-full">
                        <p className="font-semibold text-blue-500 mb-2">Quick Fixes (Under 1 Minute)</p>
                        <ul className="space-y-1">
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
                            return ["Consider minor adjustments"];
                          })().map((item: string, idx: number) => (
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
              className="relative cursor-pointer hover:border-primary transition-colors border-2 border-primary overflow-hidden w-full max-w-[348px] sm:max-w-full p-4 rounded-[15px] h-[117px] sm:h-auto sm:min-h-[117px]"
              onClick={() => {
                trackClick('style_check_button', 'outfit-battle', { feature: 'outfit_battle' });
                onNavigate('outfit-battle');
              }}
            >
              {/* Background diagonal stripes - Layer 1 (behind everything) */}
              <div className="absolute right-0 top-0 bottom-0 w-[45%] sm:w-[35%] overflow-hidden pointer-events-none">
                <div 
                  className="absolute bg-primary/25 w-6 h-[180px] -top-[30px] right-[72px] sm:right-[60px] -rotate-[30deg]"
                />
                <div 
                  className="absolute bg-primary/25 w-6 h-[180px] -top-[30px] right-[28px] sm:right-[20px] -rotate-[30deg]"
                />
              </div>

              {/* VS Text on the right - Layer 2 (side-by-side) */}
              <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <div className="relative flex items-end" style={{ gap: '-8px' }}>
                  <span 
                    className="font-satoshi text-primary text-[48px] sm:text-[64px] font-black italic leading-[0.9] -translate-y-1.5 drop-shadow-md"
                  >
                    V
                  </span>
                  <span 
                    className="font-satoshi text-primary text-[48px] sm:text-[64px] font-black italic leading-[0.9] translate-y-1.5 drop-shadow-md"
                  >
                    s
                  </span>
                </div>
              </div>

              {/* Left side content - Layer 3 */}
              <div className="relative z-20 flex flex-col h-full pt-1 pb-[15px] max-w-[60%] sm:max-w-[65%]">
                <div className="mb-2 sm:mb-[10px]">
                  <h3 
                    className="font-boston font-bold text-primary text-lg sm:text-[20px] leading-[1.2] -mt-[13px] mb-1.5"
                  >
                    Outfit Battle
                  </h3>
                  <p 
                    className="font-boston text-foreground/80 text-xs sm:text-sm leading-[1.4] hidden sm:block"
                  >
                    Upload, compare, and crown the<br />best outfit.
                  </p>
                  <p 
                    className="font-boston text-foreground/80 text-xs leading-[1.4] sm:hidden"
                  >
                    Upload, compare, crown the best outfit.
                  </p>
                </div>
                <div className="mt-auto">
                  <Button 
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-boston font-bold w-[76px] h-[19px] rounded-[4px] text-xs p-0"
                  >
                    Let's fight!
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default StyleCheckHub;
