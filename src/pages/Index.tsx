import { useState, useEffect } from "react";
import AICompanion from "@/components/AICompanion";
import Wardrobe from "@/components/Wardrobe";
import StyleCheck from "@/components/StyleCheck";
import Profile from "@/components/Profile";
import Onboarding from "@/components/Onboarding";
import OnboardingPhotos from "@/components/OnboardingPhotos";
import FeatureWalkthrough from "@/components/FeatureWalkthrough";
import WelcomeLanding from "@/components/WelcomeLanding";
import PhoneAuth from "@/components/PhoneAuth";
import TopAppBar from "@/components/TopAppBar";
import { supabase } from "@/integrations/supabase/client";

type Tab = "home" | "wardrobe" | "stylecheck" | "profile";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showWelcome, setShowWelcome] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    checkAuthAndFlow();
  }, []);

  const checkAuthAndFlow = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setShowWelcome(true);
      return;
    }

    const lastLogin = localStorage.getItem("last_login");
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    if (!lastLogin || parseInt(lastLogin) <= sevenDaysAgo) {
      await supabase.auth.signOut();
      localStorage.clear();
      setShowWelcome(true);
      return;
    }

    const user = session.user;
    const onboardingCompleteInMetadata = user?.user_metadata?.onboarding_complete === true;
    const onboardingCompleteInStorage = localStorage.getItem("onboardingComplete") === "true";
    const walkthroughComplete = localStorage.getItem("walkthroughComplete") === "true";
    const isSignIn = localStorage.getItem("is_signin") === "true";

    if (onboardingCompleteInMetadata && !onboardingCompleteInStorage) {
      localStorage.setItem("onboardingComplete", "true");
    }

    if (isSignIn) {
      localStorage.removeItem("is_signin");
    }

    if (!isSignIn && !onboardingCompleteInMetadata && !onboardingCompleteInStorage) {
      setShowOnboarding(true);
    } else if (!walkthroughComplete) {
      setShowWalkthrough(true);
    }
  };

  if (showWelcome) {
    return (
      <WelcomeLanding
        onSignUp={() => {
          setIsSignUp(true);
          setShowWelcome(false);
          setShowAuth(true);
        }}
        onLogIn={() => {
          setIsSignUp(false);
          setShowWelcome(false);
          setShowAuth(true);
        }}
      />
    );
  }

  if (showAuth) {
    return (
      <PhoneAuth
        isSignUp={isSignUp}
        onBack={() => {
          setShowAuth(false);
          setShowWelcome(true);
        }}
        onSuccess={() => {
          setShowAuth(false);
          setShowOnboarding(true);
        }}
      />
    );
  }

  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={() => {
          setShowOnboarding(false);
          setShowPhotos(true);
        }}
      />
    );
  }

  if (showPhotos) {
    return (
      <OnboardingPhotos
        onComplete={() => {
          setShowPhotos(false);
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
