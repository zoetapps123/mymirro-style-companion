import { Settings, LogOut, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Style Enthusiast");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || "");
      // Try to get name from onboarding data
      const storedName = localStorage.getItem("onboard_name");
      if (storedName) {
        setUserName(storedName);
      } else if (user.user_metadata?.name) {
        setUserName(user.user_metadata.name);
      }
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      // Clear all localStorage
      localStorage.clear();
      // Reload to trigger auth flow
      window.location.reload();
    }
  };

  const handleReferFriend = () => {
    const referralText = `Check out MyMirro - Your AI Fashion Companion! 👗✨`;
    const referralUrl = window.location.origin;
    
    if (navigator.share) {
      navigator.share({
        title: 'MyMirro - AI Fashion Companion',
        text: referralText,
        url: referralUrl,
      }).catch(() => {
        // Fallback if share fails
        copyToClipboard(referralUrl);
      });
    } else {
      copyToClipboard(referralUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Link copied!",
      description: "Share MyMirro with your friends",
    });
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto pb-safe">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-gradient-primary">Profile</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage your style journey and preferences
        </p>
      </div>

      {/* User Info Card */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl sm:text-3xl glow-primary flex-shrink-0">
            👤
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base sm:text-lg truncate">{userName}</h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
          <Button variant="ghost" size="icon" className="min-w-[40px] min-h-[40px] flex-shrink-0">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-primary">42</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Wardrobe Items</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-accent">8</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Saved Looks</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-primary">15</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Style Checks</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-accent">3</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Battles Won</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button 
          variant="outline" 
          className="w-full glass-card border-border/50 justify-start min-h-[44px] text-sm"
          onClick={handleReferFriend}
        >
          <Share2 className="w-4 h-4 mr-3 flex-shrink-0" />
          <span className="truncate">Refer a Friend</span>
        </Button>
        <Button 
          variant="outline" 
          className="w-full glass-card border-border/50 justify-start text-destructive min-h-[44px] text-sm"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-3 flex-shrink-0" />
          <span className="truncate">Sign Out</span>
        </Button>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-border/50 text-center space-y-0.5">
        <p className="text-[10px] sm:text-xs text-muted-foreground">MyMirro v1.0</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">
          Made with 💜 for style enthusiasts
        </p>
      </div>
    </div>
  );
};

export default Profile;
