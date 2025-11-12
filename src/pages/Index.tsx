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
import { useAnalytics } from "@/hooks/useAnalytics";

type Tab = "home" | "wardrobe" | "stylecheck" | "profile";

// Safe localStorage wrapper to avoid iOS Private Mode errors
const safeLocalStorage = {
  get: (key: string) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key: string, value: string) => { try { localStorage.setItem(key, value); } catch {}
  },
  clear: () => { try { localStorage.clear(); } catch {} }
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showWelcome, setShowWelcome] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // Initialize analytics tracking
  const { trackCustom } = useAnalytics();

  useEffect(() => {
    checkAuthAndFlow();
  }, []);

  // Track tab changes (must be before any early returns to keep hooks order stable)
  useEffect(() => {
    trackCustom('tab_change', { tab: activeTab });
  }, [activeTab, trackCustom]);
  const checkAuthAndFlow = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setShowWelcome(true);
        return;
      }

      const lastLogin = safeLocalStorage.get("last_login");
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      if (!lastLogin || parseInt(lastLogin) <= sevenDaysAgo) {
        await supabase.auth.signOut();
        safeLocalStorage.clear();
        setShowWelcome(true);
        return;
      }

      const user = session.user;

      // Check if user profile has required basic info
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('name, age_range')
        .eq('id', user.id)
        .single();

      const hasBasicInfo = profile?.name && profile?.age_range;

      // Check if user has uploaded minimum wardrobe items
      const { data: wardrobeItems } = await supabase
        .from('wardrobe_items')
        .select('id')
        .eq('user_id', user.id);

      const hasMinimumItems = (wardrobeItems?.length || 0) >= 3;

      // Show onboarding only if basic info is missing
      if (!hasBasicInfo) {
        setShowOnboarding(true);
        return;
      }

      // Show photos page only if minimum items not uploaded
      if (!hasMinimumItems) {
        setShowPhotos(true);
        return;
      }

      // Everything is complete
      const walkthroughComplete = safeLocalStorage.get("walkthroughComplete") === "true";
      if (!walkthroughComplete) {
        setShowWalkthrough(true);
      }
    } catch (err) {
      console.error('checkAuthAndFlow failed:', err);
      setShowWelcome(true);
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
          if (isSignUp) {
            // New user - show onboarding
            setShowOnboarding(true);
          } else {
            // Existing user logging in - check what they need
            checkAuthAndFlow();
          }
        }}
      />
    );
  }

  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={() => {
          setShowOnboarding(false);
          setActiveTab("home"); // Go directly to chat after onboarding
        }}
        onBack={() => {
          setShowOnboarding(false);
          setShowAuth(true);
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
