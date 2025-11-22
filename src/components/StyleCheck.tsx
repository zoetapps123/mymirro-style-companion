import { useState, useEffect } from "react";
import StyleCheckHub from "./StyleCheckHub";
import OutfitCheck from "./OutfitCheck";
import OutfitBattle from "./OutfitBattle";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/hooks/useAnalytics";
import { ANALYTICS_EVENTS } from "@/lib/analyticsEvents";

type StyleCheckView = 'hub' | 'outfit-check' | 'outfit-battle';

// Safe localStorage wrapper to avoid iOS Private Mode errors
const safeLocalStorage = {
  get: (key: string) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key: string, value: string) => { try { localStorage.setItem(key, value); } catch {} },
};

const StyleCheck = () => {
  const { trackScreenView } = useAnalytics();
  
  // Restore last view from localStorage
  const getInitialView = (): StyleCheckView => {
    const saved = safeLocalStorage.get('stylecheck_current_view');
    return (saved as StyleCheckView) || 'hub';
  };
  
  const getInitialBattleData = () => {
    const saved = safeLocalStorage.get('stylecheck_battle_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  };
  
  const [currentView, setCurrentView] = useState<StyleCheckView>(getInitialView());
  const [battleData, setBattleData] = useState<any>(getInitialBattleData());

  // Persist view to localStorage whenever it changes
  useEffect(() => {
    safeLocalStorage.set('stylecheck_current_view', currentView);
  }, [currentView]);
  
  // Persist battle data to localStorage whenever it changes
  useEffect(() => {
    if (battleData) {
      safeLocalStorage.set('stylecheck_battle_data', JSON.stringify(battleData));
    }
  }, [battleData]);
  
  // Track screen views for StyleCheck sub-views with standardized naming
  useEffect(() => {
    const routeMap: Record<StyleCheckView, { route: string; title: string }> = {
      'hub': { route: '/stylecheck', title: 'Style Check Hub' },
      'outfit-check': { route: '/stylecheck/check', title: 'Outfit Check' },
      'outfit-battle': { route: '/stylecheck/battle', title: 'Outfit Battle' }
    };
    
    const { route, title } = routeMap[currentView];
    trackScreenView(
      `stylecheck-${currentView}`,
      { stylecheck_view: currentView, page_title: title },
      route,
      route
    );
  }, [currentView, trackScreenView]);

  const handleNavigateToBattle = (outfitData: any) => {
    setBattleData(outfitData);
    setCurrentView('outfit-battle');
  };

  const renderView = () => {
    switch (currentView) {
      case 'hub':
        return <StyleCheckHub onNavigate={setCurrentView} onNavigateToBattle={handleNavigateToBattle} />;
      case 'outfit-check':
        return <OutfitCheck onBack={() => setCurrentView('hub')} onNavigateToBattle={handleNavigateToBattle} />;
      case 'outfit-battle':
        return <OutfitBattle onBack={() => setCurrentView('hub')} initialData={battleData} />;
      default:
        return <StyleCheckHub onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {currentView !== 'hub' && (
        <div className="p-4 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('hub')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Style Check
          </Button>
        </div>
      )}
      {renderView()}
    </div>
  );
};

export default StyleCheck;