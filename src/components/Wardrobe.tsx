import { useState } from "react";
import WardrobeHub from "./WardrobeHub";
import WardrobeUpload from "./WardrobeUpload";
import AutoGenerateOutfits from "./AutoGenerateOutfits";
import WardrobeMyItems from "./WardrobeMyItems";
import WardrobeOutfitSuggestion from "./WardrobeOutfitSuggestion";
import WardrobeLookbook from "./WardrobeLookbook";
import WardrobeComingSoon from "./WardrobeComingSoon";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type WardrobeView = 'hub' | 'upload' | 'generate' | 'calendar' | 'items' | 'suggestion' | 'lookbook';

const Wardrobe = () => {
  const [currentView, setCurrentView] = useState<WardrobeView>('hub');

  const renderView = () => {
    switch (currentView) {
      case 'hub':
        return <WardrobeHub onNavigate={setCurrentView} />;
      case 'upload':
        return <WardrobeUpload onBack={() => setCurrentView('hub')} />;
      case 'generate':
        return <AutoGenerateOutfits onBack={() => setCurrentView('hub')} />;
      case 'items':
        return <WardrobeMyItems onBack={() => setCurrentView('upload')} onNavigate={setCurrentView} />;
      case 'suggestion':
        return <WardrobeOutfitSuggestion onBack={() => setCurrentView('hub')} onNavigate={setCurrentView} />;
      case 'lookbook':
        return <WardrobeLookbook onBack={() => setCurrentView('hub')} onNavigate={setCurrentView} />;
      case 'calendar':
        return <WardrobeComingSoon onBack={() => setCurrentView('hub')} />;
      default:
        return <WardrobeHub onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {currentView !== 'hub' && (
        <div className="p-3 sm:p-4 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('hub')}
            className="gap-2 min-h-[44px]"
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