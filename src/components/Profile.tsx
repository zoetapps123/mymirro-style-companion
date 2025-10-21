import { User, Mic, Settings, LogOut, Share2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const Profile = () => {
  const voiceUsedSeconds = 120;
  const voiceTotalSeconds = 300;
  const voiceUsedPercent = (voiceUsedSeconds / voiceTotalSeconds) * 100;

  return (
    <div className="flex flex-col h-full p-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Manage your style journey and preferences
        </p>
      </div>

      {/* User Info Card */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl glow-primary">
            👤
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Style Enthusiast</h3>
            <p className="text-xs text-muted-foreground">Member since Jan 2025</p>
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Voice Usage */}
        <div className="pt-4 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">Voice Usage Today</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {Math.floor(voiceUsedSeconds / 60)}:{(voiceUsedSeconds % 60).toString().padStart(2, "0")} / 5:00
            </span>
          </div>
          <Progress value={voiceUsedPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Resets daily. Chat has no limits!
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">42</p>
          <p className="text-xs text-muted-foreground mt-1">Wardrobe Items</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-accent">8</p>
          <p className="text-xs text-muted-foreground mt-1">Saved Looks</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">15</p>
          <p className="text-xs text-muted-foreground mt-1">Style Checks</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-accent">3</p>
          <p className="text-xs text-muted-foreground mt-1">Battles Won</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button variant="outline" className="w-full glass-card border-border/50 justify-start">
          <Share2 className="w-4 h-4 mr-3" />
          Refer a Friend
        </Button>
        <Button variant="outline" className="w-full glass-card border-border/50 justify-start">
          <FileText className="w-4 h-4 mr-3" />
          Export My Data
        </Button>
        <Button variant="outline" className="w-full glass-card border-border/50 justify-start text-destructive">
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </Button>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-border/50 text-center space-y-1">
        <p className="text-xs text-muted-foreground">MyMirro v1.0</p>
        <p className="text-xs text-muted-foreground">
          Made with 💜 for style enthusiasts
        </p>
      </div>
    </div>
  );
};

export default Profile;
