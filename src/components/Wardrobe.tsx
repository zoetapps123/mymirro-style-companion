import { useState } from "react";
import WardrobeHub from "./WardrobeHub";
import WardrobeUpload from "./WardrobeUpload";
import GenerateOutfits from "./GenerateOutfits";
import PlanLooks from "./PlanLooks";
import WardrobeItemSelector from "./WardrobeItemSelector";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type WardrobeView = 'hub' | 'upload' | 'generate' | 'calendar' | 'select-item';

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  image_url: string;
  processed_image_url: string;
  color: string;
}

const Wardrobe = () => {
  const [currentView, setCurrentView] = useState<WardrobeView>('hub');
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);

  const handleItemSelect = (item: WardrobeItem) => {
    setSelectedItem(item);
    setCurrentView('generate');
  };

  const handleTryAnotherItem = () => {
    setSelectedItem(null);
    setCurrentView('select-item');
  };

  const renderView = () => {
    switch (currentView) {
      case 'hub':
        return <WardrobeHub onNavigate={setCurrentView} />;
      case 'upload':
        return <WardrobeUpload onBack={() => setCurrentView('hub')} />;
      case 'select-item':
        return <WardrobeItemSelector onSelect={handleItemSelect} onBack={() => setCurrentView('hub')} />;
      case 'generate':
        return (
          <GenerateOutfits
            selectedItem={selectedItem}
            onBack={() => setCurrentView('hub')}
            onTryAnother={handleTryAnotherItem}
          />
        );
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