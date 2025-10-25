import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Crown, Trophy, Share2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface Participant {
  name: string;
  imageData: string;
  imageFile?: File;
}

interface BattleResult {
  name: string;
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

      setParticipants([...participants, {
        name: currentName || `Participant ${participants.length + 1}`,
        imageData: reader.result as string,
        imageFile: file
      }]);
      setCurrentName("");
    };
    reader.readAsDataURL(file);
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
      const { data, error } = await supabase.functions.invoke('score-battle', {
        body: { participants }
      });

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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
      
      toast({
        title: "Battle complete!",
        description: `${data.results[0].name} takes the crown!`,
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

    const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
    gradient.addColorStop(0, 'hsl(240, 10%, 8%)');
    gradient.addColorStop(1, 'hsl(240, 8%, 12%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.fillStyle = 'hsl(295, 75%, 58%)';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MyMirro Battle', 540, 120);

    ctx.fillStyle = 'hsl(240, 5%, 98%)';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('👑', 540, 220);
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(results.results[0].name, 540, 300);
    ctx.font = '32px sans-serif';
    ctx.fillStyle = 'hsl(180, 65%, 45%)';
    ctx.fillText(`${results.results[0].score.toFixed(1)} / 5.0`, 540, 360);

    let y = 480;
    results.results.forEach((result, index) => {
      ctx.fillStyle = index === 0 ? 'hsl(180, 65%, 45%)' : 'hsl(240, 5%, 40%)';
      ctx.font = index === 0 ? 'bold 36px sans-serif' : '32px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${result.rank}. ${result.name}`, 140, y);
      
      ctx.textAlign = 'right';
      ctx.fillText(result.score.toFixed(1), 940, y);
      
      y += 80;
    });

    ctx.fillStyle = 'hsl(240, 5%, 40%)';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Good fights all around', 540, 1780);

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
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Outfit Battle</h2>
        <p className="text-sm text-muted-foreground">Pit outfits head-to-head. Winner gets the crown.</p>
      </div>

      {!results && (
        <>
          <div className="space-y-3">
            <Input
              placeholder="Participant name (optional)"
              value={currentName}
              onChange={(e) => setCurrentName(e.target.value)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={addParticipant}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={participants.length >= 5}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Outfit ({participants.length}/5)
            </Button>
          </div>

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
            <Button onClick={startBattle} disabled={loading} className="w-full glow-primary">
              {loading ? "Judging..." : "Start Battle"}
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
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
              >
                <Crown className="w-16 h-16 mx-auto text-primary" />
              </motion.div>
              <div>
                <h3 className="text-3xl font-bold text-gradient-primary mb-2">
                  {results.results[0].name}
                </h3>
                <Badge variant="secondary" className="text-lg">
                  {results.results[0].score.toFixed(1)} / 5.0
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground italic">
                {results.results[0].reasoning}
              </p>
            </div>

            <div className="pt-4 border-t border-border/50 space-y-3">
              <h4 className="font-semibold">Leaderboard</h4>
              {results.results.map((result, index) => (
                <motion.div
                  key={result.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-4 p-3 rounded-lg ${
                    index === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/20'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className={`text-2xl font-bold ${index === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {result.rank}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{result.name}</p>
                      <p className="text-xs text-muted-foreground">{result.reasoning}</p>
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
