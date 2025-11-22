import { Settings, LogOut, Share2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserAnalytics } from "@/hooks/useUserAnalytics";
import { useAnalytics } from "@/hooks/useAnalytics";
import { formatDistanceToNow } from "date-fns";

const Profile = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { trackCustom, trackScreenView } = useAnalytics();
  const [userName, setUserName] = useState("Style Enthusiast");
  const [userEmail, setUserEmail] = useState("");
  const { analytics, loading: analyticsLoading } = useUserAnalytics();

  // Track screen view on mount
  useEffect(() => {
    trackScreenView('profile', { context: 'user_profile' }, '/app/profile');
  }, [trackScreenView]);

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
    trackCustom('sign_out_clicked', { source: 'profile' }, 'profile:sign_out');
    
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
    // Use deployed URL if available, otherwise fallback to current origin
    const deployedUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const referralText = `Check out MyMirro - Your AI Fashion Companion! 👗✨\n\n${deployedUrl}`;
    
    trackCustom('referral_initiated', {
      share_method: navigator.share ? 'native' : 'clipboard',
      wardrobe_items: analytics.wardrobeItems,
      saved_outfits: analytics.savedOutfits
    }, 'profile:referral');
    
    if (navigator.share) {
      navigator.share({
        title: 'MyMirro - AI Fashion Companion',
        text: referralText,
        url: deployedUrl,
      }).catch(() => {
        // Fallback if share fails
        copyToClipboard(deployedUrl);
      });
    } else {
      copyToClipboard(deployedUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Link copied! 🎉",
      description: "Paste and share this link with your friends anywhere",
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
          <Button variant="ghost" size="icon" className="min-w-[40px] min-h-[40px] flex-shrink-0" onClick={() => {
            trackCustom('settings_opened', { source: 'profile' }, 'profile:settings_opened');
          }}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div 
          className="glass-card rounded-xl p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            trackCustom('profile_stat_clicked', {
              stat_type: 'wardrobe_items',
              stat_value: analytics.wardrobeItems
            }, 'profile:stat_clicked');
          }}
        >
          <p className="text-xl sm:text-2xl font-bold text-primary">
            {analyticsLoading ? '...' : analytics.wardrobeItems}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Wardrobe Items</p>
        </div>
        <div 
          className="glass-card rounded-xl p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            trackCustom('profile_stat_clicked', {
              stat_type: 'saved_outfits',
              stat_value: analytics.savedOutfits
            }, 'profile:stat_clicked');
          }}
        >
          <p className="text-xl sm:text-2xl font-bold text-accent">
            {analyticsLoading ? '...' : analytics.savedOutfits}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Saved Looks</p>
        </div>
        <div 
          className="glass-card rounded-xl p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            trackCustom('profile_stat_clicked', {
              stat_type: 'style_checks',
              stat_value: analytics.styleChecks
            }, 'profile:stat_clicked');
          }}
        >
          <p className="text-xl sm:text-2xl font-bold text-primary">
            {analyticsLoading ? '...' : analytics.styleChecks}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Style Checks</p>
        </div>
        <div 
          className="glass-card rounded-xl p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            trackCustom('profile_stat_clicked', {
              stat_type: 'battles_won',
              stat_value: analytics.battlesWon
            }, 'profile:stat_clicked');
          }}
        >
          <p className="text-xl sm:text-2xl font-bold text-accent">
            {analyticsLoading ? '...' : analytics.battlesWon}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Battles Won</p>
        </div>
        <div 
          className="glass-card rounded-xl p-3 text-center col-span-2 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            trackCustom('profile_stat_clicked', {
              stat_type: 'total_events',
              stat_value: analytics.totalEvents
            }, 'profile:stat_clicked');
          }}
        >
          <p className="text-xl sm:text-2xl font-bold text-primary">
            {analyticsLoading ? '...' : analytics.totalEvents}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Events Planned</p>
        </div>
      </div>

      {/* Recent Activity */}
      {!analyticsLoading && analytics.recentActivity.length > 0 && (
        <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm sm:text-base">Recent Activity</h3>
          </div>
          <div className="space-y-2">
            {analytics.recentActivity.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-start gap-2 pb-2 border-b border-border/30 last:border-0 last:pb-0">
                <div className="flex-1">
                  <p className="text-xs sm:text-sm">{activity.description}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(activity.date), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
