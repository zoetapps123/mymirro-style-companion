import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Crown, Trophy, Share2, Plus, X, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import Confetti from 'react-confetti';
import { useAnalytics } from "@/hooks/useAnalytics";

// Image compression helper
// Image compression utility moved to shared lib

interface Participant {
  name: string;
  imageData: string;
  imageFile?: File;
  occasion?: string;
  brand?: string;
  color?: string;
  vibe?: string;
}

interface BattleResult {
  name: string;
  persona_name: string;
  score: number;
  rank: number;
  roast: string;
  imageData?: string;
  styleCheck?: {
    outfit_name: string;
    overall_score: number;
    fit_score: number;
    color_score: number;
    styling_score: number;
    material_score: number;
    what_works: string[];
    what_doesnt_work: string[];
    quick_fixes: string[];
    editorial: string;
  };
  individualScores?: {
    fit: number;
    color: number;
    styling: number;
    material: number;
  };
}

interface OutfitBattleProps {
  onBack: () => void;
  initialData?: any;
}

const OutfitBattle = ({ onBack, initialData }: OutfitBattleProps) => {
  const { trackCustom, trackScreenView } = useAnalytics();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentName, setCurrentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningProgress, setScanningProgress] = useState<{current: number, total: number, name: string}>({ current: 0, total: 0, name: '' });
  const [results, setResults] = useState<{ results: BattleResult[], winner_verdict: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [awaitingName, setAwaitingName] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ imageData: string, imageFile: File } | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [comparisonText, setComparisonText] = useState<string>("");

  // Track screen view on mount
  useEffect(() => {
    trackScreenView(
      'outfit-battle',
      { context: 'battle_setup' },
      '/app/stylecheck/outfit-battle',
      '/app/stylecheck/outfit-battle'
    );
  }, [trackScreenView]);

  const addParticipant = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Support multiple file selection
    Array.from(files).forEach((file, idx) => {
      if (participants.length + idx >= 5) {
        toast({
          title: "Maximum reached",
          description: "You can add up to 5 outfits",
          variant: "destructive"
        });
        return;
      }

      // Compress image before storing
      compressImage(file)
        .then((compressedData) => {
          setPendingImage({
            imageData: compressedData,
            imageFile: file
          });
          setAwaitingName(true);
        })
        .catch((error) => {
          console.error('Image compression failed:', error);
          toast({
            title: "Image error",
            description: "Failed to process image. Try another photo.",
            variant: "destructive"
          });
        });
    });
  };

  const confirmParticipant = () => {
    if (!pendingImage) return;
    
    if (!currentName.trim()) {
      toast({
        title: "Name Required",
        description: "Who's rocking this look? Enter their name below.",
        variant: "destructive"
      });
      return;
    }

    setParticipants([...participants, {
      name: currentName.trim(),
      imageData: pendingImage.imageData,
      imageFile: pendingImage.imageFile
    }]);
    setCurrentName("");
    setPendingImage(null);
    setAwaitingName(false);
  };

  const cancelPendingImage = () => {
    setPendingImage(null);
    setCurrentName("");
    setAwaitingName(false);
  };

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: keyof Participant, value: string) => {
    setParticipants(prev => prev.map((p, i) => 
      i === index ? { ...p, [field]: value } : p
    ));
  };

  const simulateComparison = async () => {
    const totalParticipants = participants.length;
    
    // Simulate individual analysis for each participant
    for (let i = 0; i < totalParticipants; i++) {
      setScanningProgress({ current: i + 1, total: totalParticipants, name: participants[i].name });
      setComparisonText(`Analyzing ${participants[i].name}'s fit, color harmony, and styling...`);
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    
    setComparisonText(`Determining the winner... 🔥`);
    await new Promise(resolve => setTimeout(resolve, 800));
    setComparisonText("");
    setScanningProgress({ current: 0, total: 0, name: '' });
  };

  const startBattle = async () => {
    if (participants.length < 2) {
      toast({
        title: "Need more participants",
        description: "Add at least 2 outfits to battle",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setScanning(true);

    // Start comparison dialogue
    simulateComparison();

    // Show scanning animation for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

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

      const { data, error } = await supabase.functions.invoke('score-battle', { 
        body: { participants },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) {
        console.error('Score battle error:', error);
        const status = (error as any)?.context?.response?.status;
        const errorMessage = (error as any)?.message || 'Unknown error';
        setScanning(false);
        setLoading(false);

        if (status === 429) {
          toast({ title: 'Rate limited', description: 'Too many requests. Please try again in a minute.', variant: 'destructive' });
        } else if (status === 402) {
          toast({ title: 'Service temporarily unavailable', description: 'Please try again later.', variant: 'destructive' });
        } else if (status === 504) {
          toast({ title: 'Taking longer than usual', description: 'AI timeout. Please try again.', variant: 'destructive' });
        } else {
          toast({ title: 'Battle failed', description: `Unable to score battle. ${errorMessage}`, variant: 'destructive' });
        }
        return;
      }

      if (!data) {
        console.error('No data returned from score-battle');
        setScanning(false);
        setLoading(false);
        toast({ title: 'Error', description: 'No response from server. Try again.', variant: 'destructive' });
        return;
      }

      // Attach images to results and show UI immediately
      const resultsWithImages = data.results.map((result: BattleResult) => {
        const participant = participants.find(p => p.name === result.name);
        return { ...result, imageData: participant?.imageData };
      });

      setScanning(false);
      setResults({ ...data, results: resultsWithImages });
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
      setComparisonText("");
      toast({ title: 'Battle complete!', description: `${data.results[0].name} takes the crown! 👑` });
      
      // Track battle completion
      trackCustom('outfit_battle_completed', {
        participant_count: participants.length,
        winner: data.results[0].name,
        winner_score: data.results[0].score
      }, 'Outfit Battle - Completed', '/app/stylecheck/outfit-battle');

      // Persist battle in background (non-blocking)
      // Persist battle in background (non-blocking)
      (async () => {
        try {
          // Upload images to storage and get URLs
          const participantsWithUrls = await Promise.all(
            participants.map(async (p) => {
              try {
                const response = await fetch(p.imageData);
                const blob = await response.blob();
                const fileName = `${user.id}/battle_${Date.now()}_${p.name.replace(/\s+/g, '-')}.jpg`;
                const { error: uploadError } = await supabase.storage
                  .from('outfits')
                  .upload(fileName, blob);
                
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                  .from('outfits')
                  .getPublicUrl(fileName);

                return {
                  name: p.name,
                  occasion: p.occasion,
                  brand: p.brand,
                  color: p.color,
                  vibe: p.vibe,
                  image_url: publicUrl
                };
              } catch (e) {
                console.error('Failed to upload image for', p.name, e);
                return {
                  name: p.name,
                  occasion: p.occasion,
                  brand: p.brand,
                  color: p.color,
                  vibe: p.vibe
                };
              }
            })
          );

          const { error: battleError } = await supabase
            .from('battles')
            .insert({
              user_id: user.id,
              participants: participantsWithUrls,
              results: data.results
            });
          if (battleError) throw battleError;
        } catch (persistErr) {
          console.error('Battle save failed:', persistErr);
          toast({ title: 'Not saved to history', description: 'Results shown, but could not save. Try again later.' });
        }
      })();
    } catch (error) {
      console.error('Error:', error);
      setScanning(false);
      toast({
        title: "Error",
        description: "Failed to score battle. Try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!results) return;

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

    // Title
    ctx.fillStyle = 'hsl(295, 75%, 58%)';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MyMirro Battle', 540, 100);

    // Winner section - larger space
    const winner = results.results[0];
    if (winner.imageData) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = winner.imageData!;
      });
      
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(240, 160, 600, 600, 30);
      ctx.clip();
      const imgAspect = img.width / img.height;
      let drawWidth, drawHeight, offsetX, offsetY;
      if (imgAspect > 1) {
        drawHeight = 600;
        drawWidth = drawHeight * imgAspect;
        offsetX = 240 - (drawWidth - 600) / 2;
        offsetY = 160;
      } else {
        drawWidth = 600;
        drawHeight = drawWidth / imgAspect;
        offsetX = 240;
        offsetY = 160 - (drawHeight - 600) / 2;
      }
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      ctx.restore();
    }

    // Crown on winner
    ctx.font = 'bold 80px sans-serif';
    ctx.fillText('👑', 540, 810);

    // Winner name and score
    ctx.fillStyle = 'hsl(240, 5%, 98%)';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(winner.name, 540, 880);
    ctx.font = '28px sans-serif';
    ctx.fillStyle = 'hsl(180, 65%, 45%)';
    ctx.fillText(winner.persona_name || '', 540, 920);
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(`${winner.score.toFixed(1)} / 5.0`, 540, 980);

    // Other participants in smaller frames
    let y = 1050;
    for (let i = 1; i < Math.min(results.results.length, 3); i++) {
      const result = results.results[i];
      
      if (result.imageData) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = result.imageData!;
        });
        
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(90, y, 200, 200, 20);
        ctx.clip();
        const imgAspect = img.width / img.height;
        let drawWidth, drawHeight, offsetX, offsetY;
        if (imgAspect > 1) {
          drawHeight = 200;
          drawWidth = drawHeight * imgAspect;
          offsetX = 90 - (drawWidth - 200) / 2;
          offsetY = y;
        } else {
          drawWidth = 200;
          drawHeight = drawWidth / imgAspect;
          offsetX = 90;
          offsetY = y - (drawHeight - 200) / 2;
        }
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        ctx.restore();
      }

      ctx.fillStyle = 'hsl(240, 5%, 70%)';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${result.rank}. ${result.name}`, 320, y + 80);
      ctx.font = '24px sans-serif';
      ctx.fillText(result.persona_name || '', 320, y + 120);
      
      ctx.fillStyle = 'hsl(180, 65%, 45%)';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(result.score.toFixed(1), 990, y + 100);
      
      y += 250;
    }

    // Footer message
    ctx.fillStyle = 'hsl(240, 5%, 50%)';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(results.winner_verdict.substring(0, 60), 540, 1850);

    const shareImage = canvas.toDataURL('image/png');
    const response = await fetch(shareImage);
    const blob = await response.blob();
    const file = new File([blob], 'mymirro-battle.png', { type: 'image/png' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'MyMirro Battle' });
    } else {
      const link = document.createElement('a');
      link.href = shareImage;
      link.download = 'mymirro-battle.png';
      link.click();
      toast({ title: "Image downloaded!", description: "Share your battle results" });
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4 pb-safe">
      {scanning && participants.length > 0 && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-4 sm:space-y-6">
            <div className={`grid ${participants.length === 2 ? 'grid-cols-2' : participants.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-3 sm:gap-4`}>
              {participants.map((participant, index) => (
                <div key={index} className="relative">
                  <img 
                    src={participant.imageData} 
                    alt={participant.name}
                    className={`w-full ${participants.length > 3 ? 'aspect-square' : 'aspect-[3/4]'} object-cover rounded-2xl`}
                  />
                  <div className="absolute inset-0 rounded-2xl overflow-hidden">
                    <div className="scanning-line"></div>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 glass-card px-2 py-1 rounded-lg">
                    <p className="text-xs font-medium text-center truncate">{participant.name}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <h3 className="text-lg sm:text-xl font-bold text-gradient-accent">Let's settle this fashion face-off</h3>
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              </div>
              {scanningProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">{scanningProgress.current}/{scanningProgress.total}</span>
                    <span>participants analyzed</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-primary to-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${(scanningProgress.current / scanningProgress.total) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}
              {comparisonText && (
                <motion.p 
                  key={comparisonText}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-muted-foreground italic"
                >
                  {comparisonText}
                </motion.p>
              )}
            </div>
          </div>
        </div>
      )}

      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Outfit Battle</h2>
        <p className="text-sm text-muted-foreground">
          Upload outfits, watch them compete. Winner gets the crown 👑
        </p>
      </div>

      {!results && (
        <>
          {awaitingName && pendingImage ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-2xl p-6 space-y-4"
            >
              <div className="text-center space-y-2">
                <img 
                  src={pendingImage.imageData} 
                  alt="Pending" 
                  className="w-32 h-32 mx-auto rounded-xl object-cover"
                />
                <h3 className="text-lg font-semibold">Who's rocking this look?</h3>
                <p className="text-sm text-muted-foreground">Enter their name below</p>
              </div>
              
              <Input
                placeholder="Enter participant name"
                value={currentName}
                onChange={(e) => setCurrentName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && confirmParticipant()}
                autoFocus
                className="min-h-[44px]"
              />
              
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={cancelPendingImage} className="min-h-[44px]">
                  Cancel
                </Button>
                <Button onClick={confirmParticipant} className="glow-primary min-h-[44px]">
                  Add to Battle
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={addParticipant}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full min-h-[44px]"
                onClick={() => fileInputRef.current?.click()}
                disabled={participants.length >= 5}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Participant ({participants.length}/5)
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-auto space-y-3">
            {participants.map((participant, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-4 rounded-xl"
              >
                {editingIndex === index ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img src={participant.imageData} alt={participant.name} className="w-16 h-16 rounded-lg object-cover" />
                      <Input
                        placeholder="Name"
                        value={participant.name}
                        onChange={(e) => updateParticipant(index, 'name', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Occasion (e.g., Party)"
                        value={participant.occasion || ''}
                        onChange={(e) => updateParticipant(index, 'occasion', e.target.value)}
                      />
                      <Input
                        placeholder="Brand (optional)"
                        value={participant.brand || ''}
                        onChange={(e) => updateParticipant(index, 'brand', e.target.value)}
                      />
                      <Input
                        placeholder="Color (e.g., Navy)"
                        value={participant.color || ''}
                        onChange={(e) => updateParticipant(index, 'color', e.target.value)}
                      />
                      <Input
                        placeholder="Vibe (e.g., Edgy)"
                        value={participant.vibe || ''}
                        onChange={(e) => updateParticipant(index, 'vibe', e.target.value)}
                      />
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setEditingIndex(null)}
                      className="w-full"
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <img src={participant.imageData} alt={participant.name} className="w-16 h-16 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{participant.name}</p>
                      <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                        {participant.occasion && <span className="px-2 py-0.5 bg-muted rounded-full">{participant.occasion}</span>}
                        {participant.brand && <span className="px-2 py-0.5 bg-muted rounded-full">{participant.brand}</span>}
                        {participant.color && <span className="px-2 py-0.5 bg-muted rounded-full">{participant.color}</span>}
                        {participant.vibe && <span className="px-2 py-0.5 bg-muted rounded-full">{participant.vibe}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingIndex(index)}
                      >
                        <Sparkles className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeParticipant(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {participants.length >= 2 && (
            <Button onClick={startBattle} disabled={loading} className="w-full glow-primary min-h-[44px]">
              {loading ? "Judging..." : "Start Battle 🔥"}
            </Button>
          )}
        </>
      )}

      {results && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 overflow-auto space-y-4 pb-24"
        >
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="text-center space-y-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              >
                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    repeat: Infinity,
                    duration: 2,
                    delay: 0.5
                  }}
                >
                  <Crown className="w-16 h-16 mx-auto text-primary" />
                </motion.div>
              </motion.div>
              {results.results[0].imageData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1
                  }}
                  transition={{ delay: 0.3 }}
                  className="relative"
                >
                  <motion.div
                    animate={{ 
                      boxShadow: [
                        '0 0 0 0 rgba(var(--primary-rgb), 0)',
                        '0 0 0 8px rgba(var(--primary-rgb), 0.2)',
                        '0 0 0 0 rgba(var(--primary-rgb), 0)'
                      ]
                    }}
                    transition={{ 
                      repeat: Infinity,
                      duration: 2,
                      ease: "easeInOut"
                    }}
                    className="rounded-2xl"
                  >
                    <img 
                      src={results.results[0].imageData} 
                      alt={results.results[0].name}
                      className="w-48 h-48 mx-auto rounded-2xl object-cover border-4 border-primary/20"
                    />
                  </motion.div>
                </motion.div>
              )}
              <div>
                <motion.h3 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-3xl font-bold text-gradient-primary mb-1"
                >
                  {results.results[0].name}
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-accent font-medium mb-2"
                >
                  {results.results[0].persona_name}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Badge variant="secondary" className="text-lg">
                    {results.results[0].score.toFixed(1)} / 5.0
                  </Badge>
                </motion.div>
              </div>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-sm text-muted-foreground italic"
              >
                {results.results[0].roast}
              </motion.p>
            </div>

            <div className="pt-4 border-t border-border/50 space-y-3">
              <motion.h4 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="font-semibold"
              >
                Leaderboard
              </motion.h4>
              {results.results.map((result, index) => (
                <motion.div
                  key={result.name}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ 
                    delay: 1.2 + index * 0.15,
                    type: "spring",
                    stiffness: 200
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    index === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/20'
                  }`}
                >
                  {result.imageData && (
                    <img 
                      src={result.imageData} 
                      alt={result.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex items-center gap-3 flex-1">
                    <span className={`text-xl font-bold ${index === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {result.rank}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{result.name}</p>
                      <p className="text-xs text-accent">{result.persona_name}</p>
                      {result.individualScores && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Fit {result.individualScores.fit.toFixed(1)}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Color {result.individualScores.color.toFixed(1)}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Style {result.individualScores.styling.toFixed(1)}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Material {result.individualScores.material.toFixed(1)}
                          </Badge>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{result.roast}</p>
                    </div>
                  </div>
                  <Badge variant={index === 0 ? "default" : "outline"}>
                    {result.score.toFixed(1)}
                  </Badge>
                </motion.div>
              ))}
            </div>

            <div className="pt-4 border-t border-border/50">
              <p className="text-sm text-center italic text-muted-foreground mb-4">
                {results.winner_verdict}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button onClick={() => { setResults(null); setParticipants([]); }}>
                Rematch
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default OutfitBattle;
