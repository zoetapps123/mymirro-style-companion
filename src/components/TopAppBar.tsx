import { Home, Shirt, Sparkles, Swords } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Tab = "home" | "wardrobe" | "stylecheck" | "battles" | "profile";

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
    { id: "home" as Tab, icon: Home, label: "Home" },
    { id: "wardrobe" as Tab, icon: Shirt, label: "Wardrobe" },
    { id: "stylecheck" as Tab, icon: Sparkles, label: "Style Check" },
    { id: "battles" as Tab, icon: Swords, label: "Battles" },
  ];

  return (
    <header 
      className="sticky top-0 z-[100] backdrop-blur-xl bg-[#0D0D10]/70 shadow-lg"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between px-3 py-2 relative">
        {/* Left: Nav icons */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                aria-label={item.label}
                className={`h-10 w-10 grid place-items-center rounded-xl transition-all duration-300 active:scale-95 relative ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "scale-110" : ""} transition-transform`} />
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-gradient-to-r from-[#C86CF6] to-[#00D7C0]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Center: Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight select-none text-gradient-primary">
            MYMIRRO
          </h1>
        </div>

        {/* Right: Profile */}
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
    </header>
  );
};

export default TopAppBar;
