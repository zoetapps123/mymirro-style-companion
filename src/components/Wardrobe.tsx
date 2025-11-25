import { useState, useEffect } from "react";
import WardrobeMyItems from "./WardrobeMyItems";
import WardrobeOutfitSuggestion from "./WardrobeOutfitSuggestion";
import WardrobeLookbook from "./WardrobeLookbook";
import WardrobeComingSoon from "./WardrobeComingSoon";
import { useAnalytics } from "@/hooks/useAnalytics";
import { WARDROBE_ROUTES, WARDROBE_PAGE_TITLES } from "@/lib/wardrobeRoutes";
import { trackPageView } from "@/lib/mixpanel";
import { SCREEN_NAMES, SCREEN_PATHS } from "@/lib/screenRoutes";

type WardrobeView = 'items' | 'suggestion' | 'calendar' | 'lookbook';

// Safe localStorage wrapper to avoid iOS Private Mode errors
const safeLocalStorage = {
  get: (key: string) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key: string, value: string) => { try { localStorage.setItem(key, value); } catch {} },
};

const Wardrobe = () => {
  // const { trackScreenView } = useAnalytics();
  
  // Restore last view from localStorage
  const getInitialView = (): WardrobeView => {
    const saved = safeLocalStorage.get('wardrobe_current_view');
    return (saved as WardrobeView) || 'items';
  };
  
  const [currentView, setCurrentView] = useState<WardrobeView>(getInitialView());

  // Persist view to localStorage whenever it changes
  useEffect(() => {
    safeLocalStorage.set('wardrobe_current_view', currentView);
  }, [currentView]);
  
  // Track virtual page views for wardrobe sub-views (Mixpanel only here to avoid duplicate backend analytics)
  useEffect(() => {
    const routeMap: Record<WardrobeView, string> = {
      'items': WARDROBE_ROUTES.GALLERY,
      'suggestion': WARDROBE_ROUTES.OUTFITS,
      'calendar': WARDROBE_ROUTES.CALENDAR,
      'lookbook': WARDROBE_ROUTES.LOOKBOOK
    };
    
    const route = routeMap[currentView];
    const title = WARDROBE_PAGE_TITLES[route];
    
    // Mixpanel analytics only (backend analytics auto-track route already)
    const mixpanelScreenMap: Record<WardrobeView, { name: string; path: string }> = {
      'items': { name: SCREEN_NAMES.WARDROBE_GALLERY, path: SCREEN_PATHS.WARDROBE_GALLERY },
      'suggestion': { name: SCREEN_NAMES.WARDROBE_OUTFITS, path: SCREEN_PATHS.WARDROBE_OUTFITS },
      'calendar': { name: SCREEN_NAMES.WARDROBE_CALENDAR, path: SCREEN_PATHS.WARDROBE_CALENDAR },
      'lookbook': { name: SCREEN_NAMES.WARDROBE_LOOKBOOK, path: SCREEN_PATHS.WARDROBE_LOOKBOOK }
    };
    const screenInfo = mixpanelScreenMap[currentView];
    trackPageView(screenInfo.name, screenInfo.path, { wardrobe_view: currentView, page_title: title });
  }, [currentView]);

  const renderView = () => {
    switch (currentView) {
      case 'items':
        return <WardrobeMyItems onNavigate={setCurrentView} />;
      case 'suggestion':
        return <WardrobeOutfitSuggestion onBack={() => setCurrentView('items')} onNavigate={setCurrentView} />;
      case 'lookbook':
        return <WardrobeLookbook onBack={() => setCurrentView('items')} onNavigate={setCurrentView} />;
      case 'calendar':
        return <WardrobeComingSoon onBack={() => setCurrentView('items')} onNavigate={setCurrentView} />;
      default:
        return <WardrobeMyItems onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {renderView()}
    </div>
  );
};

export default Wardrobe;