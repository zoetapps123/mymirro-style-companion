import { useState, useEffect } from "react";
import { DoorOpen, Sparkles, Calendar, Shirt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WardrobeLookbookProps {
  onBack: () => void;
  onNavigate: (view: 'items' | 'suggestion' | 'calendar' | 'lookbook') => void;
}

const WardrobeLookbook = ({ onBack, onNavigate }: WardrobeLookbookProps) => {
  const [outfits, setOutfits] = useState<any[]>([]);
  const { toast } = useToast();

  const features = [
    { icon: DoorOpen, title: "Your\nCloset", view: 'items' as const, active: false },
    { icon: Sparkles, title: "Outfit\nSuggestion", view: 'suggestion' as const, active: false },
    { icon: Calendar, title: "Plan Your\nLook", view: 'calendar' as const, active: false },
    { icon: Shirt, title: "Your\nLookbook", view: 'lookbook' as const, active: true },
  ];

  useEffect(() => {
    fetchOutfits();
  }, []);

  const fetchOutfits = async () => {
    const { data, error } = await supabase
      .from("outfits")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load outfits.",
        variant: "destructive",
      });
      return;
    }

    setOutfits(data || []);
  };

  return (
    <div className="flex flex-col h-full bg-background">
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

      {/* Title */}
      <div className="px-4 pb-3">
        <h2 className="text-3xl font-bold text-primary">My Items</h2>
      </div>

      {/* Outfits Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {outfits.map((outfit, index) => (
            <div
              key={outfit.id}
              className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-border/50 relative"
            >
              {outfit.preview_image_url ? (
                <img
                  src={outfit.preview_image_url}
                  alt={outfit.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted" />
              )}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-primary text-lg font-semibold">
                  {index === 0 ? "Outfit Name" : ""}
                </p>
              </div>
            </div>
          ))}

          {/* Placeholder cards if no outfits */}
          {outfits.length === 0 &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-2xl bg-muted border-2 border-border/50 relative"
              >
                {i === 0 && (
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-primary text-lg font-semibold">Outfit Name</p>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default WardrobeLookbook;
