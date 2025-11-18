import { useState, useEffect } from "react";
import AICompanion from "@/components/AICompanion";
import Wardrobe from "@/components/Wardrobe";
import StyleCheck from "@/components/StyleCheck";
import Profile from "@/components/Profile";
import Onboarding from "@/components/Onboarding";

import FeatureWalkthrough from "@/components/FeatureWalkthrough";

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
  const [showAuth, setShowAuth] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // Initialize analytics tracking
  const { trackCustom, trackScreenView } = useAnalytics();

  useEffect(() => {
    checkAuthAndFlow();
  }, []);

  // Track virtual page views and screen changes for tab changes
  useEffect(() => {
    trackScreenView(activeTab, { tab: activeTab });
    trackCustom('page_view', {
      virtual_path: `/app/${activeTab}`,
      tab: activeTab,
    });
  }, [activeTab, trackCustom, trackScreenView]);
  const checkAuthAndFlow = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setShowAuth(true);
        setIsSignUp(true);
        return;
      }

      const lastLogin = safeLocalStorage.get("last_login");
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      if (!lastLogin || parseInt(lastLogin) <= sevenDaysAgo) {
        await supabase.auth.signOut();
        safeLocalStorage.clear();
        setShowAuth(true);
        setIsSignUp(true);
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

      // Show onboarding only if basic info is missing
      if (!hasBasicInfo) {
        setShowOnboarding(true);
        return;
      }

      // Everything is complete
      const walkthroughComplete = safeLocalStorage.get("walkthroughComplete") === "true";
      if (!walkthroughComplete) {
        setShowWalkthrough(true);
      }
    } catch (err) {
      console.error('checkAuthAndFlow failed:', err);
      setShowAuth(true);
      setIsSignUp(true);
    }
  };

  if (showAuth) {
    return (
      <PhoneAuth
        isSignUp={isSignUp}
        onBack={() => {
          setIsSignUp(!isSignUp);
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
