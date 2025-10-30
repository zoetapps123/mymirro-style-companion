import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WardrobeLookbookProps {
  onBack: () => void;
}

const WardrobeLookbook = ({ onBack }: WardrobeLookbookProps) => {
  const [outfits, setOutfits] = useState<any[]>([]);
  const { toast } = useToast();

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
      {/* Title */}
      <div className="p-4 pb-3">
        <h2 className="text-2xl font-bold text-primary">My Items</h2>
      </div>

      {/* Outfits Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {outfits.map((outfit) => (
            <div
              key={outfit.id}
              className="aspect-[3/4] rounded-2xl overflow-hidden border border-border/50 relative"
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
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white text-base font-semibold truncate text-primary">
                  {outfit.name || "Outfit Name"}
                </p>
              </div>
            </div>
          ))}

          {/* Placeholder cards if no outfits */}
          {outfits.length === 0 &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-2xl bg-muted border border-border/50"
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default WardrobeLookbook;
