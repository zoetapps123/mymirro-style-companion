import { useState, useEffect } from "react";
import { Home, Sparkles, Shirt, User } from "lucide-react";
import AICompanion from "@/components/AICompanion";
import Wardrobe from "@/components/Wardrobe";
import StyleCheck from "@/components/StyleCheck";

import Profile from "@/components/Profile";
import Onboarding from "@/components/Onboarding";
import FeatureWalkthrough from "@/components/FeatureWalkthrough";
import Auth from "@/components/Auth";

type Tab = "home" | "wardrobe" | "stylecheck" | "profile";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    // Check flow status based on localStorage
    const email = localStorage.getItem("onboard_email");
    const onboardingComplete = localStorage.getItem("onboardingComplete") === "true";
    const walkthroughComplete = localStorage.getItem("walkthroughComplete") === "true";

    if (!email) {
      setShowEmailCapture(true);
    } else if (!onboardingComplete) {
      setShowOnboarding(true);
    } else if (!walkthroughComplete) {
      setShowWalkthrough(true);
    }
  }, []);

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
