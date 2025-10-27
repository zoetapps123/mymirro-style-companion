import { MessageCircle, Shirt, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Tab = "home" | "wardrobe" | "stylecheck" | "profile";

interface TopAppBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TopAppBar = ({ activeTab, onTabChange }: TopAppBarProps) => {
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

  const navItems = [
    { id: "home" as Tab, icon: MessageCircle, label: "AI Companion" },
    { id: "wardrobe" as Tab, icon: Shirt, label: "Wardrobe" },
    { id: "stylecheck" as Tab, icon: Sparkles, label: "Style Check" },
  ];

  return (
    <header 
      className="sticky top-0 z-[100] backdrop-blur-xl bg-[#0D0D10]/70 shadow-lg"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Top row: Logo + Profile */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex-1" />
        
        {/* Center: Logo */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight select-none text-gradient-primary">
          MYMIRRO
        </h1>

        {/* Right: Profile */}
        <div className="flex-1 flex justify-end">
          <button
            onClick={() => onTabChange("profile" as Tab)}
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
      <nav className="flex items-center justify-around px-4 py-3 border-t border-border/20">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-300 active:scale-95 relative min-w-[80px] ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "scale-110" : ""} transition-transform`} />
              <span className="text-[11px] font-medium leading-tight whitespace-nowrap">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full bg-gradient-to-r from-[#C86CF6] to-[#00D7C0]" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};

export default TopAppBar;
