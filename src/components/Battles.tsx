import { Crown, Trophy, Upload, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { useToast } from "@/hooks/use-toast";

const mockBattle = [
  { name: "Aarav", score: 4.3, rank: 1 },
  { name: "Riya", score: 4.1, rank: 2 },
  { name: "You", score: 3.8, rank: 3 },
];

const Battles = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    toast({
      title: "Outfits uploaded!",
      description: "Setting up your battle...",
    });
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

      {/* Start Battle CTA */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
      />
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="glass-card rounded-2xl p-8 border-2 border-dashed border-border/50 text-center space-y-4 hover:border-primary/50 transition-colors cursor-pointer"
      >
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center glow-primary">
          <Camera className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">Start a New Battle</h3>
          <p className="text-xs text-muted-foreground">
            Upload 2-5 outfits to compare and rank
          </p>
        </div>
        <Button className="glow-primary">
          <Trophy className="w-4 h-4 mr-2" />
          Create Battle
        </Button>
      </div>

      {/* Example Battle Result */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Last Battle</h3>
          <span className="text-xs text-muted-foreground">3 participants • 1 day ago</span>
        </div>

        {/* Leaderboard */}
        <div className="space-y-3">
          {mockBattle.map((participant) => (
            <div
              key={participant.name}
              className={`rounded-xl p-4 flex items-center justify-between ${
                participant.rank === 1
                  ? "bg-primary/20 border-2 border-primary/50 glow-primary"
                  : "bg-muted/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  {participant.rank === 1 && (
                    <Crown className="absolute -top-6 -left-1 w-6 h-6 text-primary animate-pulse" />
                  )}
                  <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center text-2xl">
                    {participant.rank === 1 ? "👑" : participant.rank === 2 ? "🥈" : "🥉"}
                  </div>
                </div>
                <div>
                  <p className="font-semibold">{participant.name}</p>
                  <p className="text-xs text-muted-foreground">Rank #{participant.rank}</p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`text-2xl font-bold ${
                    participant.rank === 1 ? "text-primary" : "text-foreground"
                  }`}
                >
                  {participant.score}
                </p>
                <p className="text-xs text-muted-foreground">/ 5.0</p>
              </div>
            </div>
          ))}
        </div>

        {/* Winner Verdict */}
        <div className="pt-4 border-t border-border/50">
          <p className="text-sm mb-2">
            <span className="font-semibold text-primary">Aarav</span> takes the crown! 🎉
          </p>
          <p className="text-xs text-muted-foreground">
            Perfect color coordination + sharp fit = unbeatable combo. Others: try tucking your
            shirt and adding a statement accessory.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Battles;
