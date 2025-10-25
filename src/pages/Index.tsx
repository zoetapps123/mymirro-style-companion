import { useState, useEffect } from "react";
import { Home, Sparkles, Shirt, Trophy, User } from "lucide-react";
import AICompanion from "@/components/AICompanion";
import Wardrobe from "@/components/Wardrobe";
import StyleCheck from "@/components/StyleCheck";
import Battles from "@/components/Battles";
import Profile from "@/components/Profile";
import Onboarding from "@/components/Onboarding";
import FeatureWalkthrough from "@/components/FeatureWalkthrough";
import Auth from "@/components/Auth";
import { supabase } from "@/integrations/supabase/client";

type Tab = "home" | "wardrobe" | "stylecheck" | "battles" | "profile";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      const hasCompletedOnboarding = localStorage.getItem("onboardingComplete") === "true";
      const isFirstLogin = localStorage.getItem("isFirstLogin") === "true";
      const walkthroughComplete = localStorage.getItem("walkthroughComplete") === "true";
      
      if (!hasCompletedOnboarding) {
        setShowOnboarding(true);
      } else if (isFirstLogin && !walkthroughComplete) {
        setShowWalkthrough(true);
      }
    }
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (showOnboarding) {
    return <Onboarding onComplete={() => {
      setShowOnboarding(false);
      setShowWalkthrough(true);
    }} />;
  }

  if (showWalkthrough) {
    return <FeatureWalkthrough onComplete={() => setShowWalkthrough(false)} />;
  }

  const tabs = [
    { id: "home" as Tab, icon: Home, label: "AI Companion" },
    { id: "wardrobe" as Tab, icon: Shirt, label: "Wardrobe" },
    { id: "stylecheck" as Tab, icon: Sparkles, label: "Style Check" },
    { id: "battles" as Tab, icon: Trophy, label: "Battles" },
    { id: "profile" as Tab, icon: User, label: "Profile" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return <AICompanion />;
      case "wardrobe":
        return <Wardrobe />;
      case "stylecheck":
        return <StyleCheck />;
      case "battles":
        return <Battles />;
      case "profile":
        return <Profile />;
      default:
        return <AICompanion />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="glass-card border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gradient-primary">MyMirro</h1>
        <p className="text-xs text-muted-foreground">Your AI Stylist Companion</p>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className="glass-card border-t border-border/50 px-4 py-3 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300 ${
                isActive
                  ? "text-primary glow-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? "scale-110" : ""} transition-transform`} />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Index;
