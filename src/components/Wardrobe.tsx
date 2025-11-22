import { useState, useEffect } from "react";
import WardrobeMyItems from "./WardrobeMyItems";
import WardrobeOutfitSuggestion from "./WardrobeOutfitSuggestion";
import WardrobeLookbook from "./WardrobeLookbook";
import WardrobeComingSoon from "./WardrobeComingSoon";
import { useAnalytics } from "@/hooks/useAnalytics";
import { WARDROBE_ROUTES, WARDROBE_PAGE_TITLES } from "@/lib/wardrobeRoutes";

type WardrobeView = 'items' | 'suggestion' | 'calendar' | 'lookbook';

const Wardrobe = () => {
  const { trackScreenView } = useAnalytics();
  const [currentView, setCurrentView] = useState<WardrobeView>('items');

  // Track virtual page views for wardrobe sub-views with consistent route naming
  useEffect(() => {
    const routeMap: Record<WardrobeView, string> = {
      'items': WARDROBE_ROUTES.GALLERY,
      'suggestion': WARDROBE_ROUTES.OUTFITS,
      'calendar': WARDROBE_ROUTES.CALENDAR,
      'lookbook': WARDROBE_ROUTES.LOOKBOOK
    };
    
    const route = routeMap[currentView];
    const title = WARDROBE_PAGE_TITLES[route];
    
    trackScreenView(
      `wardrobe-${currentView}`,
      { 
        wardrobe_view: currentView,
        page_title: title
      },
      route,
      route
    );
  }, [currentView, trackScreenView]);

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