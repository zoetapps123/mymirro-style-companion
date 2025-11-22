import { useState, useEffect } from "react";
import WardrobeMyItems from "./WardrobeMyItems";
import WardrobeOutfitSuggestion from "./WardrobeOutfitSuggestion";
import WardrobeLookbook from "./WardrobeLookbook";
import WardrobeComingSoon from "./WardrobeComingSoon";
import { useAnalytics } from "@/hooks/useAnalytics";

type WardrobeView = 'items' | 'suggestion' | 'calendar' | 'lookbook';

const Wardrobe = () => {
  const { trackCustom } = useAnalytics();
  const [currentView, setCurrentView] = useState<WardrobeView>('items');

  // Track virtual page views for wardrobe sub-views
  useEffect(() => {
    trackCustom('page_view', {
      virtual_path: `/app/wardrobe/${currentView}`,
      wardrobe_view: currentView,
    }, `Wardrobe - ${currentView.charAt(0).toUpperCase() + currentView.slice(1)} View`);
  }, [currentView, trackCustom]);

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