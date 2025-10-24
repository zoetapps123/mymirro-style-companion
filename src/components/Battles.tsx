import { Crown, Trophy, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Participant {
  name: string;
  imageData: string;
  file: File;
}

interface BattleResult {
  name: string;
  score: number;
  rank: number;
  reasoning: string;
}

interface Battle {
  id: string;
  results: BattleResult[];
  winner_verdict: string;
  created_at: string;
}

const Battles = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [latestBattle, setLatestBattle] = useState<Battle | null>(null);

  useEffect(() => {
    fetchLatestBattle();
  }, []);

  const fetchLatestBattle = async () => {
    const { data, error } = await supabase
      .from('battles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching battle:', error);
      return;
    }

    if (data) {
      setLatestBattle({
        id: data.id,
        results: (data.results as any).results || [],
        winner_verdict: (data.results as any).winner_verdict || 'Battle complete!',
        created_at: data.created_at,
      });
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newParticipants: Participant[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      await new Promise((resolve) => {
        reader.onloadend = () => {
          const name = prompt(`Name for participant ${i + 1}:`) || `Participant ${i + 1}`;
          newParticipants.push({
            name,
            imageData: reader.result as string,
            file
          });
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    }

    setParticipants(prev => [...prev, ...newParticipants]);
    toast({
      title: `${newParticipants.length} participant(s) added`,
      description: "Add more or start the battle!",
    });
  };

  const removeParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const startBattle = async () => {
    if (participants.length < 2) {
      toast({
        title: "Need more participants",
        description: "Add at least 2 outfits to start a battle",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to create battles",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Battle starting...",
        description: "Comparing and scoring all outfits...",
      });

      // Score the battle
      const { data, error } = await supabase.functions.invoke('score-battle', {
        body: { 
          participants: participants.map(p => ({
            name: p.name,
            imageData: p.imageData
          }))
        }
      });

      if (error) {
        console.error('Score battle error:', error);
        throw error;
      }
      
      console.log('Battle results:', data);

      // Save to database
      const { error: dbError } = await supabase
        .from('battles')
        .insert({
          user_id: user.id,
          participants: participants.map(p => ({ name: p.name })),
          results: data,
        });

      if (dbError) throw dbError;

      const winner = data.results.find((r: BattleResult) => r.rank === 1);
      toast({
        title: "Battle complete!",
        description: `${winner?.name} takes the crown! 👑`,
      });

      setParticipants([]);
      fetchLatestBattle();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to score battle. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Outfit Battles</h2>
        <p className="text-sm text-muted-foreground">
          Settle it with style. Crown today's best look.
        </p>
      </div>

      {/* Upload Area */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageSelect}
        className="hidden"
        disabled={loading}
      />
      
      <div 
        onClick={() => !loading && fileInputRef.current?.click()}
        className="glass-card rounded-2xl p-8 border-2 border-dashed border-border/50 text-center space-y-4 hover:border-primary/50 transition-colors cursor-pointer"
      >
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center glow-primary">
          <Camera className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">
            {loading ? "Battle in progress..." : "Add Participants"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {participants.length === 0 
              ? "Upload 2-5 outfits to compare" 
              : `${participants.length} participant(s) ready`}
          </p>
        </div>
      </div>

      {/* Participants Preview */}
      {participants.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Participants:</h3>
          <div className="grid grid-cols-2 gap-2">
            {participants.map((participant, index) => (
              <div key={index} className="glass-card p-2 rounded-lg relative">
                <button
                  onClick={() => removeParticipant(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
                <img 
                  src={participant.imageData} 
                  alt={participant.name}
                  className="w-full aspect-square object-cover rounded-lg mb-2"
                />
                <p className="text-xs font-medium text-center">{participant.name}</p>
              </div>
            ))}
          </div>
          <Button 
            onClick={startBattle} 
            disabled={loading || participants.length < 2}
            className="w-full glow-primary"
          >
            <Trophy className="w-4 h-4 mr-2" />
            {loading ? "Scoring..." : "Start Battle"}
          </Button>
        </div>
      )}

      {/* Latest Battle Results */}
      {latestBattle && latestBattle.results.length > 0 && (
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Latest Battle</h3>
            <span className="text-xs text-muted-foreground">
              {latestBattle.results.length} participants • {new Date(latestBattle.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Leaderboard */}
          <div className="space-y-3">
            {latestBattle.results.map((result) => (
              <div
                key={result.name}
                className={`rounded-xl p-4 flex items-center justify-between ${
                  result.rank === 1
                    ? "bg-primary/20 border-2 border-primary/50 glow-primary"
                    : "bg-muted/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {result.rank === 1 && (
                      <Crown className="absolute -top-6 -left-1 w-6 h-6 text-primary animate-pulse" />
                    )}
                    <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center text-2xl">
                      {result.rank === 1 ? "👑" : result.rank === 2 ? "🥈" : "🥉"}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold">{result.name}</p>
                    <p className="text-xs text-muted-foreground">Rank #{result.rank}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-2xl font-bold ${
                      result.rank === 1 ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {result.score.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">/ 5.0</p>
                </div>
              </div>
            ))}
          </div>

          {/* Winner Verdict */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-sm mb-2">
              <span className="font-semibold text-primary">
                {latestBattle.results[0]?.name}
              </span> takes the crown! 🎉
            </p>
            <p className="text-xs text-muted-foreground">
              {latestBattle.winner_verdict}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Battles;