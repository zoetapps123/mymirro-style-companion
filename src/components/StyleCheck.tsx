import { useState } from "react";
import StyleCheckHub from "./StyleCheckHub";
import OutfitCheck from "./OutfitCheck";
import OutfitBattle from "./OutfitBattle";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type StyleCheckView = 'hub' | 'outfit-check' | 'outfit-battle';

const StyleCheck = () => {
  const [currentView, setCurrentView] = useState<StyleCheckView>('hub');

  const renderView = () => {
    switch (currentView) {
      case 'hub':
        return <StyleCheckHub onNavigate={setCurrentView} />;
      case 'outfit-check':
        return <OutfitCheck onBack={() => setCurrentView('hub')} />;
      case 'outfit-battle':
        return <OutfitBattle onBack={() => setCurrentView('hub')} />;
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