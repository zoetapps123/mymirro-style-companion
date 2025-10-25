import { useState, useEffect } from "react";
import { Home, Sparkles, Shirt, User } from "lucide-react";
import AICompanion from "@/components/AICompanion";
import Wardrobe from "@/components/Wardrobe";
import StyleCheck from "@/components/StyleCheck";
import Profile from "@/components/Profile";
import Onboarding from "@/components/Onboarding";
import FeatureWalkthrough from "@/components/FeatureWalkthrough";
import Auth from "@/components/Auth";
import { supabase } from "@/integrations/supabase/client";

type Tab = "home" | "wardrobe" | "stylecheck" | "profile";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    checkAuthAndFlow();
  }, []);

  const checkAuthAndFlow = async () => {
    // Check if user has valid session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // No session - show auth
      setShowEmailCapture(true);
      return;
    }

    // Check if session is within 7 days
    const lastLogin = localStorage.getItem("last_login");
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    if (!lastLogin || parseInt(lastLogin) <= sevenDaysAgo) {
      // Session expired - show auth
      await supabase.auth.signOut();
      localStorage.clear();
      setShowEmailCapture(true);
      return;
    }

    // Valid session - check onboarding status
    const onboardingComplete = localStorage.getItem("onboardingComplete") === "true";
    const walkthroughComplete = localStorage.getItem("walkthroughComplete") === "true";

    if (!onboardingComplete) {
      setShowOnboarding(true);
    } else if (!walkthroughComplete) {
      setShowWalkthrough(true);
    }
  };

  const handleEmailCaptured = (email: string) => {
    localStorage.setItem("onboard_email", email);
    setShowEmailCapture(false);
    setShowOnboarding(true);
  };

  if (showEmailCapture) {
    return <Auth onEmailCaptured={handleEmailCaptured} />;
  }

  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={() => {
          localStorage.setItem("onboardingComplete", "true");
          setShowOnboarding(false);
          setShowWalkthrough(true);
        }}
      />
    );
  }

  if (showWalkthrough) {
    return (
      <FeatureWalkthrough
        onComplete={() => {
          localStorage.setItem("walkthroughComplete", "true");
          setShowWalkthrough(false);
        }}
      />
    );
  }

  const tabs = [
    { id: "home" as Tab, icon: Home, label: "AI Companion" },
    { id: "wardrobe" as Tab, icon: Shirt, label: "Wardrobe" },
    { id: "stylecheck" as Tab, icon: Sparkles, label: "Style Check" },
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
      case "profile":
        return <Profile />;
      default:
        return <AICompanion />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="glass-card border-b border-border/50 px-4 py-3 flex items-center justify-between min-h-[56px]">
        <h1 className="text-xl font-bold text-gradient-primary">MyMirro</h1>
        <p className="text-xs text-muted-foreground hidden sm:block">Your AI Stylist Companion</p>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>

      {/* Bottom Navigation - Mobile Optimized */}
      <nav className="glass-card border-t border-border/50 px-2 py-2 flex items-center justify-around safe-area-bottom">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 min-w-[64px] min-h-[56px] ${
                isActive
                  ? "text-primary glow-primary"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? "scale-110" : ""} transition-transform`} />
              <span className="text-[10px] sm:text-xs font-medium leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Index;
