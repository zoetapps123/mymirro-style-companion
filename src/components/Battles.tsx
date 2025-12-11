import { Crown, Trophy, Camera, X, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { ImageUploadSheet, useImageUploadSheet } from "@/components/ui/image-upload-sheet";

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
  const { trackCustom, trackScreenView } = useAnalytics();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [currentScanIndex, setCurrentScanIndex] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [latestBattle, setLatestBattle] = useState<Battle | null>(null);
  const { isOpen: uploadSheetOpen, setIsOpen: setUploadSheetOpen, isMobile, desktopInputRef, openUpload } = useImageUploadSheet();

  useEffect(() => {
    fetchLatestBattle();
  }, []);
  
  // Track screen view on mount
  useEffect(() => {
    trackScreenView('stylecheck-battles', { context: 'style_check' }, '/app/stylecheck/battles');
  }, [trackScreenView]);

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
    setScanning(true);

    // Animate scanning each participant
    for (let i = 0; i < participants.length; i++) {
      setCurrentScanIndex(i);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    setScanning(false);

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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      // Score the battle
      const { data, error } = await supabase.functions.invoke('score-battle', {
        body: { 
          participants: participants.map(p => ({
            name: p.name,
            imageData: p.imageData
          }))
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
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
      
      // Track battle completion
      trackCustom('outfit_battle_completed', {
        participant_count: participants.length,
        winner_name: winner?.name,
        winner_score: winner?.score,
      }, 'user_action:complete_battle');
      
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 4000);

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

  const generateBattleShareImage = async (): Promise<string> => {
    return new Promise((resolve) => {
      if (!latestBattle) return resolve('');
      
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;

      // Background
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
      ctx.fillStyle = 'hsl(240, 5%, 70%)';
      ctx.font = '32px sans-serif';
      ctx.fillText('Outfit Battle Results', 540, 180);

      // Winner section
      const winner = latestBattle.results[0];
      ctx.fillStyle = 'hsl(295, 75%, 58%)';
      ctx.font = 'bold 96px sans-serif';
      ctx.fillText('👑', 540, 320);
      ctx.fillStyle = 'hsl(240, 5%, 98%)';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText(winner.name, 540, 420);
      ctx.font = 'bold 72px sans-serif';
      ctx.fillStyle = 'hsl(295, 75%, 58%)';
      ctx.fillText(`${winner.score.toFixed(1)}/5.0`, 540, 520);

      // Leaderboard
      let yPos = 660;
      latestBattle.results.forEach((result, index) => {
        const emoji = index === 0 ? '👑' : index === 1 ? '🥈' : '🥉';
        
        ctx.fillStyle = 'hsl(240, 5%, 98%)';
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(emoji, 100, yPos);
        
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText(result.name, 200, yPos);
        
        ctx.fillStyle = 'hsl(180, 65%, 45%)';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(result.score.toFixed(1), 980, yPos);
        
        yPos += 100;
      });

      // Winner verdict
      yPos += 60;
      ctx.fillStyle = 'hsl(240, 5%, 70%)';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      const verdictLines = wrapText(ctx, latestBattle.winner_verdict, 920);
      verdictLines.forEach((line, i) => {
        ctx.fillText(line, 540, yPos + (i * 40));
      });

      // CTA
      ctx.fillStyle = 'hsl(240, 5%, 40%)';
      ctx.font = '32px sans-serif';
      ctx.fillText('Battle your outfits at', 540, 1780);
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

  const handleShareBattle = async () => {
    if (!latestBattle) return;

    try {
      setLoading(true);
      const shareImage = await generateBattleShareImage();
      
      const response = await fetch(shareImage);
      const blob = await response.blob();
      const file = new File([blob], 'mymirro-battle.png', { type: 'image/png' });

      const shareData = {
        files: [file],
        title: 'MyMirro Outfit Battle',
        text: `Battle results on MyMirro! 👑\n\nCheck your style at mymirro.app ✨`
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        const link = document.createElement('a');
        link.href = shareImage;
        link.download = 'mymirro-battle.png';
        link.click();
        
        toast({
          title: "Image downloaded!",
          description: "Share your battle results on social media",
        });
      }
      
      // Track share action
      trackCustom('share_battle', {
        winner: latestBattle.results[0].name,
        participant_count: latestBattle.results.length,
        share_method: navigator.canShare && navigator.canShare(shareData) ? 'native_share' : 'download',
      }, 'user_action:share');
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
      {scanning && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-8 max-w-md w-full space-y-6">
            <div className="relative">
              <img 
                src={participants[currentScanIndex]?.imageData} 
                alt="Scanning" 
                className="w-full aspect-square object-cover rounded-2xl"
              />
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="scanning-line"></div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-gradient-primary">
                Scanning {participants[currentScanIndex]?.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                Participant {currentScanIndex + 1} of {participants.length}
              </p>
              <div className="flex justify-center gap-2 pt-4">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Celebration Overlay */}
      {showCelebration && latestBattle && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-lg flex items-center justify-center p-4">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: `hsl(${Math.random() * 360}, 70%, 60%)`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
          <div className="glass-card rounded-3xl p-12 max-w-md w-full text-center space-y-6 glow-primary">
            <div className="text-8xl animate-bounce">👑</div>
            <h2 className="text-4xl font-bold text-gradient-primary">
              {latestBattle.results[0]?.name} Wins!
            </h2>
            <div className="text-6xl font-bold text-primary">
              {latestBattle.results[0]?.score.toFixed(1)}
            </div>
            <p className="text-muted-foreground">
              {latestBattle.winner_verdict}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Outfit Battles</h2>
        <p className="text-sm text-muted-foreground">
          Settle it with style. Crown today's best look.
        </p>
      </div>

      {/* Upload Area */}
      <input
        ref={isMobile ? undefined : desktopInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageSelect}
        className="hidden"
        disabled={loading}
      />
      <ImageUploadSheet
        open={uploadSheetOpen}
        onOpenChange={setUploadSheetOpen}
        onFileSelect={handleImageSelect}
        multiple
        disabled={loading}
        title="Add Participants"
      />
      
      <div 
        onClick={() => !loading && openUpload()}
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
          <div className="pt-4 border-t border-border/50 space-y-3">
            <p className="text-base">
              <span className="font-semibold text-primary">
                {latestBattle.results[0]?.name}
              </span> takes the crown! 🎉
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {latestBattle.winner_verdict}
            </p>
          </div>

          {/* Share Button */}
          <Button 
            className="w-full glow-primary" 
            onClick={handleShareBattle}
            disabled={loading}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Battle Results
          </Button>
        </div>
      )}
    </div>
  );
};

export default Battles;