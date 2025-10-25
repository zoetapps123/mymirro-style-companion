import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Crown, Trophy, Share2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import Confetti from 'react-confetti';

interface Participant {
  name: string;
  imageData: string;
  imageFile?: File;
}

interface BattleResult {
  name: string;
  persona?: string;
  score: number;
  rank: number;
  reasoning: string;
}

interface OutfitBattleProps {
  onBack: () => void;
}

const OutfitBattle = ({ onBack }: OutfitBattleProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentName, setCurrentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ results: BattleResult[], winner_verdict: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [awaitingName, setAwaitingName] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ imageData: string, imageFile: File } | null>(null);

  const addParticipant = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      if (participants.length >= 5) {
        toast({
          title: "Maximum reached",
          description: "You can add up to 5 outfits",
          variant: "destructive"
        });
        return;
      }

      setPendingImage({
        imageData: reader.result as string,
        imageFile: file
      });
      setAwaitingName(true);
    };
    reader.readAsDataURL(file);
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
    try {
      // Check authentication first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        toast({
          title: "Authentication required",
          description: "Please sign in again to battle outfits",
          variant: "destructive",
        });
        setLoading(false);
        localStorage.clear();
        window.location.reload();
        return;
      }

      const user = session.user;

      const { data, error } = await supabase.functions.invoke('score-battle', {
        body: { participants }
      });

      if (error) {
        const status = (error as any)?.context?.response?.status;
        if (status === 429) {
          toast({ title: 'Rate limited', description: 'Too many requests. Please try again in a minute.', variant: 'destructive' });
          return;
        }
        if (status === 402) {
          toast({ title: 'Service temporarily unavailable', description: 'Please try again later.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Error', description: 'Failed to score battle. Try again.', variant: 'destructive' });
        return;
      }

      // Save battle to database
      const { data: battle, error: battleError } = await supabase
        .from('battles')
        .insert({
          user_id: user.id,
          participants: participants.map(p => ({ name: p.name })),
          results: data.results
        })
        .select()
        .single();

      if (battleError) throw battleError;

      setResults(data);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
      
      toast({
        title: "Battle complete!",
        description: `${data.results[0].name} takes the crown! 👑`,
      });
    } catch (error) {
      console.error('Error:', error);
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
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MyMirro Battle', 540, 80);

    // Load winner image
    const winnerParticipant = participants.find(p => p.name === results.results[0].name);
    if (winnerParticipant) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = winnerParticipant.imageData;
      });
      
      // Winner section with larger image
      ctx.save();
      const winnerSize = 350;
      const winnerX = (1080 - winnerSize) / 2;
      const winnerY = 140;
      ctx.beginPath();
      ctx.roundRect(winnerX, winnerY, winnerSize, winnerSize, 20);
      ctx.clip();
      ctx.drawImage(img, winnerX, winnerY, winnerSize, winnerSize);
      ctx.restore();

      // Crown above winner
      ctx.font = '80px sans-serif';
      ctx.fillText('👑', 540, 520);
    }

    // Winner name and persona
    ctx.fillStyle = 'hsl(240, 5%, 98%)';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(results.results[0].name, 540, 580);
    if (results.results[0].persona) {
      ctx.font = '32px sans-serif';
      ctx.fillStyle = 'hsl(180, 65%, 45%)';
      ctx.fillText(results.results[0].persona, 540, 630);
    }
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(`${results.results[0].score.toFixed(1)} / 5.0`, 540, 690);

    // Leaderboard with smaller images
    let y = 780;
    for (let i = 0; i < Math.min(results.results.length, 4); i++) {
      const result = results.results[i];
      const participant = participants.find(p => p.name === result.name);
      
      if (participant) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = participant.imageData;
        });
        
        // Small participant image
        ctx.save();
        const imgSize = 80;
        ctx.beginPath();
        ctx.roundRect(100, y - 60, imgSize, imgSize, 10);
        ctx.clip();
        ctx.drawImage(img, 100, y - 60, imgSize, imgSize);
        ctx.restore();
      }

      // Rank and name
      ctx.fillStyle = i === 0 ? 'hsl(180, 65%, 45%)' : 'hsl(240, 5%, 98%)';
      ctx.font = i === 0 ? 'bold 36px sans-serif' : 'bold 32px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${result.rank}. ${result.name}`, 200, y);
      
      // Persona
      if (result.persona) {
        ctx.font = '24px sans-serif';
        ctx.fillStyle = 'hsl(240, 5%, 60%)';
        ctx.fillText(result.persona, 200, y + 30);
      }
      
      // Score
      ctx.fillStyle = i === 0 ? 'hsl(180, 65%, 45%)' : 'hsl(240, 5%, 98%)';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(result.score.toFixed(1), 980, y);
      
      y += 120;
    }

    // Footer
    ctx.fillStyle = 'hsl(240, 5%, 40%)';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Battle royale complete', 540, 1820);

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
        <p className="text-sm text-muted-foreground">Pit outfits head-to-head. Winner gets the crown.</p>
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
                Add Outfit ({participants.length}/5)
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-auto space-y-3">
            {participants.map((participant, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-4 rounded-xl flex items-center gap-4"
              >
                <img src={participant.imageData} alt={participant.name} className="w-16 h-16 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="font-medium">{participant.name}</p>
                  <p className="text-xs text-muted-foreground">Ready to battle</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeParticipant(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
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
          className="flex-1 overflow-auto space-y-4"
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
                    rotate: [0, 10, -10, 0]
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
              <div>
                <motion.h3 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-3xl font-bold text-gradient-primary mb-2"
                >
                  {results.results[0].name}
                </motion.h3>
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
                {results.results[0].reasoning}
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
              {results.results.map((result, index) => {
                const participant = participants.find(p => p.name === result.name);
                return (
                  <motion.div
                    key={result.name}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ 
                      delay: 1.2 + index * 0.15,
                      type: "spring",
                      stiffness: 200
                    }}
                    className={`flex items-center gap-4 p-3 rounded-lg ${
                      index === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/20'
                    }`}
                  >
                    {participant && (
                      <img 
                        src={participant.imageData} 
                        alt={result.name}
                        className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`text-2xl font-bold flex-shrink-0 ${index === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {result.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{result.name}</p>
                        {result.persona && (
                          <p className="text-xs text-accent italic">{result.persona}</p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2">{result.reasoning}</p>
                      </div>
                    </div>
                    <Badge variant={index === 0 ? "default" : "outline"} className="flex-shrink-0">
                      {result.score.toFixed(1)}
                    </Badge>
                  </motion.div>
                );
              })}
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
