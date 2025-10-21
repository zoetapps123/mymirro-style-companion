import { Upload, CheckCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const StyleCheck = () => {
  return (
    <div className="flex flex-col h-full p-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-accent">Style Check</h2>
        <p className="text-sm text-muted-foreground">
          Proof your outfit in 30 seconds. Honest score. Easy fixes.
        </p>
      </div>

      {/* Upload Area */}
      <div className="glass-card rounded-2xl p-8 border-2 border-dashed border-border/50 text-center space-y-4 hover:border-accent/50 transition-colors cursor-pointer">
        <div className="mx-auto w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
          <Upload className="w-8 h-8 text-accent" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">Upload Your Outfit</h3>
          <p className="text-xs text-muted-foreground">
            Tap to snap or select from gallery
          </p>
        </div>
      </div>

      {/* Example Score Card (Demo) */}
      <div className="glass-card rounded-2xl p-6 space-y-4 glow-accent">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg mb-1">Last Check</h3>
            <p className="text-xs text-muted-foreground">2 hours ago • Work meeting</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gradient-accent">4.2</div>
            <p className="text-xs text-muted-foreground">out of 5.0</p>
          </div>
        </div>

        {/* Subscores */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Color", score: 4.5 },
            { label: "Fit", score: 3.8 },
            { label: "Texture", score: 4.3 },
            { label: "Style/Occasion", score: 4.2 },
          ].map((item) => (
            <div key={item.label} className="bg-muted/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-lg font-bold text-accent">{item.score}</p>
            </div>
          ))}
        </div>

        {/* Verdict */}
        <div className="pt-4 border-t border-border/50 space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-accent mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">What's working</p>
              <p className="text-xs text-muted-foreground">
                Great color harmony—navy & white is classic. Fit looks sharp on shoulders.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Quick fixes</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Roll sleeves for a relaxed vibe</li>
                <li>• Add a leather belt for structure</li>
                <li>• Swap sneakers for loafers (work context)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Share Button */}
        <Button className="w-full glass-card border-border/50" variant="outline">
          <Share2 className="w-4 h-4 mr-2" />
          Share Score Card
        </Button>
      </div>
    </div>
  );
};

export default StyleCheck;
