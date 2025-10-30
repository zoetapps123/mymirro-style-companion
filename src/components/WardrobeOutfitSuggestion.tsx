import { useState, useEffect } from "react";
import { DoorOpen, Sparkles, Calendar, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface WardrobeOutfitSuggestionProps {
  onBack: () => void;
  onNavigate: (view: 'items' | 'suggestion' | 'calendar' | 'lookbook') => void;
}

const WardrobeOutfitSuggestion = ({ onBack, onNavigate }: WardrobeOutfitSuggestionProps) => {
  const [selectedOccasion, setSelectedOccasion] = useState<string>("Daily");
  const [selectedStyle, setSelectedStyle] = useState<string>("Casual");
  const [myItems, setMyItems] = useState<any[]>([]);

  const occasions = ["Daily", "School", "Work", "Travel", "Party", "Wedding"];
  const styles = ["Casual", "Classic", "Street", "Minimal", "Athleisure"];

  const features = [
    { icon: DoorOpen, title: "Your\nCloset", view: 'items' as const, active: false },
    { icon: Sparkles, title: "Outfit\nSuggestion", view: 'suggestion' as const, active: true },
    { icon: Calendar, title: "Plan Your\nLook", view: 'calendar' as const, active: false },
    { icon: Shirt, title: "Your\nLookbook", view: 'lookbook' as const, active: false },
  ];

  useEffect(() => {
    fetchMyItems();
  }, []);

  const fetchMyItems = async () => {
    const { data } = await supabase
      .from("wardrobe_items")
      .select("*")
      .limit(4);
    setMyItems(data || []);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      {/* Feature Icons */}
      <div className="px-4 pt-6 pb-4">
        <div className="grid grid-cols-4 gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isActive = feature.active;
            return (
              <button
                key={feature.title}
                onClick={() => onNavigate(feature.view)}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                    isActive
                      ? "bg-primary border-2 border-primary"
                      : "bg-background border-2 border-border"
                  }`}
                >
                  <Icon
                    className={`w-7 h-7 ${
                      isActive ? "text-primary-foreground" : "text-muted-foreground"
                    }`}
                  />
                </div>
                <span className="text-xs font-medium text-center leading-tight whitespace-pre-line">
                  {feature.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Title */}
        <h2 className="text-2xl font-bold text-primary">Outfit Suggestions</h2>

        {/* Occasion */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-3">Occasion</h3>
          <div className="flex gap-2 flex-wrap mb-4">
            {occasions.map((occasion) => (
              <Button
                key={occasion}
                variant={selectedOccasion === occasion ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedOccasion(occasion)}
                className={`rounded-full ${
                  selectedOccasion === occasion
                    ? "bg-black text-white"
                    : "bg-transparent border-border"
                }`}
              >
                {occasion}
              </Button>
            ))}
          </div>

          {/* Placeholder Outfit Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-[3/4] rounded-2xl bg-muted border border-border" />
            <div className="aspect-[3/4] rounded-2xl bg-muted border border-border" />
          </div>
        </div>

        {/* Style */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-3">Style</h3>
          <div className="flex gap-2 flex-wrap mb-4">
            {styles.map((style) => (
              <Button
                key={style}
                variant={selectedStyle === style ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStyle(style)}
                className={`rounded-full ${
                  selectedStyle === style
                    ? "bg-black text-white"
                    : "bg-transparent border-border"
                }`}
              >
                {style}
              </Button>
            ))}
          </div>

          {/* Placeholder Outfit Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-[3/4] rounded-2xl bg-muted border border-border" />
            <div className="aspect-[3/4] rounded-2xl bg-muted border border-border" />
          </div>
        </div>

        {/* From my items */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-3">From my items</h3>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {myItems.map((item) => (
              <div
                key={item.id}
                className="aspect-square rounded-lg overflow-hidden bg-muted border border-border"
              >
                <img
                  src={item.processed_image_url || item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {Array.from({ length: Math.max(0, 4 - myItems.length) }).map((_, i) => (
              <div key={`placeholder-${i}`} className="aspect-square rounded-lg bg-muted border border-border" />
            ))}
          </div>

          {/* Placeholder Outfit Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-[3/4] rounded-2xl bg-muted border border-border" />
            <div className="aspect-[3/4] rounded-2xl bg-muted border border-border" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WardrobeOutfitSuggestion;
