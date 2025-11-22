import { MessageCircle, Shirt, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { ANALYTICS_EVENTS } from "@/lib/analyticsEvents";
import logo from "@/assets/logo.png";

type Tab = "home" | "wardrobe" | "stylecheck" | "profile";

interface TopAppBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TopAppBar = ({ activeTab, onTabChange }: TopAppBarProps) => {
  const { trackCustom } = useAnalytics();
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserAvatar(user.user_metadata?.avatar_url || null);
        setUserName(user.user_metadata?.name || user.email?.charAt(0).toUpperCase() || "U");
      }
    };
    loadUserData();
  }, []);
  
  const handleTabChange = (tab: Tab) => {
    // Track tab navigation
    trackCustom(ANALYTICS_EVENTS.TAB_CHANGE, {
      from_tab: activeTab,
      to_tab: tab,
      element_id: `nav-${tab}`,
    }, `navigation:tab_change`, `/app/${tab}`);
    
    onTabChange(tab);
  };

  const navItems = [
    { id: "home" as Tab, icon: MessageCircle, label: "AI Companion" },
    { id: "wardrobe" as Tab, icon: Shirt, label: "Wardrobe" },
    { id: "stylecheck" as Tab, icon: Sparkles, label: "Style Check" },
  ];

  return (
    <header 
      className="z-[100] backdrop-blur-xl bg-background/80 shadow-sm border-b border-border"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Top row: Logo + Profile */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Center: Logo */}
        <div className="flex-1 flex justify-center">
          <img src={logo} alt="MyMirro" className="h-8" />
        </div>

        {/* Right: Profile */}
        <div className="absolute right-4">
          <button
            onClick={() => handleTabChange("profile" as Tab)}
            aria-label="Profile"
            className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-border/50 hover:ring-primary/50 transition-all active:scale-95"
          >
            <Avatar className="h-full w-full">
              <AvatarImage src={userAvatar || undefined} alt={userName} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-foreground font-semibold">
                {userName.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </div>

      {/* Bottom row: Navigation */}
      <nav className="flex items-center justify-around px-4 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              aria-label={item.label}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-300 active:scale-95 relative min-w-[80px] ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? "scale-110" : ""} transition-transform`} />
              <span className="text-xs font-medium leading-tight whitespace-nowrap mb-[18px]">
                {item.id === "home" ? "Chat" : item.id === "wardrobe" ? "Wardrobe" : "Style Check"}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-foreground" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};

export default TopAppBar;
