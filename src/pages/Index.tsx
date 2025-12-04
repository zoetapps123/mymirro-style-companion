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
import { trackPageView, identifyUser } from "@/lib/mixpanel";
import { SCREEN_NAMES, SCREEN_PATHS } from "@/lib/screenRoutes";

type Tab = "home" | "wardrobe" | "stylecheck" | "profile";

// Safe localStorage wrapper to avoid iOS Private Mode errors
const safeLocalStorage = {
  get: (key: string) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key: string, value: string) => { try { localStorage.setItem(key, value); } catch {}
  },
  clear: () => { try { localStorage.clear(); } catch {} }
};

const Index = () => {
  // Restore last active tab from localStorage
  const getInitialTab = (): Tab => {
    const saved = safeLocalStorage.get('active_tab');
    return (saved as Tab) || 'home';
  };
  
  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab());
  const [showAuth, setShowAuth] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // Initialize analytics tracking
  const { trackCustom, trackScreenView } = useAnalytics();

  useEffect(() => {
    checkAuthAndFlow();
  }, []);

  // Persist active tab to localStorage whenever it changes
  useEffect(() => {
    safeLocalStorage.set('active_tab', activeTab);
  }, [activeTab]);

  // Track virtual page views and screen changes for tab changes
  useEffect(() => {
    trackScreenView(
      activeTab, 
      { tab: activeTab },
      `/app/${activeTab}`,
      `/app/${activeTab}`
    );
    
    // Mixpanel: Track page view with virtual paths
    const tabScreenMap: Record<Tab, { name: string; path: string }> = {
      home: { name: SCREEN_NAMES.CHAT, path: SCREEN_PATHS.CHAT },
      wardrobe: { name: SCREEN_NAMES.WARDROBE, path: SCREEN_PATHS.WARDROBE },
      stylecheck: { name: SCREEN_NAMES.STYLE_CHECK, path: SCREEN_PATHS.STYLE_CHECK },
      profile: { name: SCREEN_NAMES.PROFILE, path: SCREEN_PATHS.PROFILE }
    };
    const screenInfo = tabScreenMap[activeTab];
    trackPageView(screenInfo.name, screenInfo.path);
  }, [activeTab, trackScreenView]);
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
        .select('name, age_range, gender')
        .eq('id', user.id)
        .single();

      // Identify user in Mixpanel with profile data from database
      if (user) {
        identifyUser({
          ...user,
          user_metadata: {
            ...user.user_metadata,
            name: profile?.name || user.user_metadata?.name,
            gender: profile?.gender || user.user_metadata?.gender,
            age_range: profile?.age_range || user.user_metadata?.age_range,
          }
        });
      }

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
      {/* Top App Bar - Fixed at top */}
      <TopAppBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content - Each component manages its own scrolling */}
      <main className="flex-1 overflow-hidden pt-[140px] sm:pt-[130px]">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
