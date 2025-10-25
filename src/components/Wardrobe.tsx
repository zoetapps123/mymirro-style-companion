import { useState } from "react";
import WardrobeHub from "./WardrobeHub";
import WardrobeUpload from "./WardrobeUpload";
import GenerateOutfits from "./GenerateOutfits";
import PlanLooks from "./PlanLooks";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type WardrobeView = 'hub' | 'upload' | 'generate' | 'calendar';

const Wardrobe = () => {
  const [currentView, setCurrentView] = useState<WardrobeView>('hub');

  const renderView = () => {
    switch (currentView) {
      case 'hub':
        return <WardrobeHub onNavigate={setCurrentView} />;
      case 'upload':
        return <WardrobeUpload onBack={() => setCurrentView('hub')} />;
      case 'generate':
        return <GenerateOutfits onBack={() => setCurrentView('hub')} />;
      case 'calendar':
        return <PlanLooks onBack={() => setCurrentView('hub')} />;
      default:
        return <WardrobeHub onNavigate={setCurrentView} />;
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
            Back to Wardrobe
          </Button>
        </div>
      )}
      {renderView()}
    </div>
  );
};

export default Wardrobe;