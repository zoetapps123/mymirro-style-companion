import { useState, useEffect } from "react";
import StyleCheckHub from "./StyleCheckHub";
import OutfitCheck from "./OutfitCheck";
import OutfitBattle from "./OutfitBattle";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/hooks/useAnalytics";

type StyleCheckView = 'hub' | 'outfit-check' | 'outfit-battle';

const StyleCheck = () => {
  const { trackScreenView } = useAnalytics();
  const [currentView, setCurrentView] = useState<StyleCheckView>('hub');
  const [battleData, setBattleData] = useState<any>(null);

  // Track screen views for StyleCheck sub-views with standardized naming
  useEffect(() => {
    const screenMap: Record<StyleCheckView, string> = {
      'hub': 'stylecheck-hub',
      'outfit-check': 'stylecheck-check',
      'outfit-battle': 'stylecheck-battle'
    };
    
    const screenName = screenMap[currentView];
    trackScreenView(
      screenName,
      { stylecheck_view: currentView },
      `/app/stylecheck/${currentView}`
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