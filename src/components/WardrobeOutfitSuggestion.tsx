import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface WardrobeOutfitSuggestionProps {
  onBack: () => void;
}

const WardrobeOutfitSuggestion = ({ onBack }: WardrobeOutfitSuggestionProps) => {
  const [selectedOccasion, setSelectedOccasion] = useState<string>("Daily");
  const [selectedStyle, setSelectedStyle] = useState<string>("Casual");
  const [myItems, setMyItems] = useState<any[]>([]);

  const occasions = ["Daily", "School", "Work", "Travel", "Party", "Wedding"];
  const styles = ["Casual", "Classic", "Street", "Minimal", "Athleisure"];

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
      <div className="p-4 space-y-6">
        {/* Title */}
        <h2 className="text-2xl font-bold text-primary">Outfit Suggestions</h2>

        {/* Occasion */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-3">Occasion</h3>
          <div className="flex gap-2 flex-wrap">
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
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="aspect-[3/4] rounded-2xl bg-muted" />
            <div className="aspect-[3/4] rounded-2xl bg-muted" />
          </div>
        </div>

        {/* Style */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-3">Style</h3>
          <div className="flex gap-2 flex-wrap">
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
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="aspect-[3/4] rounded-2xl bg-muted" />
            <div className="aspect-[3/4] rounded-2xl bg-muted" />
          </div>
        </div>

        {/* From my items */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-3">From my items</h3>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {myItems.map((item) => (
              <div
                key={item.id}
                className="aspect-square rounded-lg overflow-hidden bg-muted"
              >
                <img
                  src={item.processed_image_url || item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Placeholder Outfit Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-[3/4] rounded-2xl bg-muted" />
            <div className="aspect-[3/4] rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WardrobeOutfitSuggestion;
