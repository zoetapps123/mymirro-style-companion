import { useState, useEffect } from "react";
import AICompanion from "@/components/AICompanion";
import Wardrobe from "@/components/Wardrobe";
import StyleCheck from "@/components/StyleCheck";
import Profile from "@/components/Profile";
import Onboarding from "@/components/Onboarding";
import FeatureWalkthrough from "@/components/FeatureWalkthrough";
import Auth from "@/components/Auth";
import TopAppBar from "@/components/TopAppBar";
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
    // First check user metadata (persists across devices/sessions)
    const user = session.user;
    const onboardingCompleteInMetadata = user?.user_metadata?.onboarding_complete === true;
    const onboardingCompleteInStorage = localStorage.getItem("onboardingComplete") === "true";
    const walkthroughComplete = localStorage.getItem("walkthroughComplete") === "true";
    const isSignIn = localStorage.getItem("is_signin") === "true";

    // If onboarding was completed before (in metadata), sync to localStorage
    if (onboardingCompleteInMetadata && !onboardingCompleteInStorage) {
      localStorage.setItem("onboardingComplete", "true");
      if (user?.user_metadata?.name) {
        localStorage.setItem("onboard_name", user.user_metadata.name);
      }
      if (user?.user_metadata?.gender) {
        localStorage.setItem("onboard_gender", user.user_metadata.gender);
      }
    }

    // Clear the signin flag after checking
    if (isSignIn) {
      localStorage.removeItem("is_signin");
    }

    // Show onboarding only for new signups (not sign-ins)
    // Skip onboarding if user is signing in (not signing up)
    if (!isSignIn && !onboardingCompleteInMetadata && !onboardingCompleteInStorage) {
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
      {/* Top App Bar */}
      <TopAppBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Scrollable Main Content with proper spacing */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
