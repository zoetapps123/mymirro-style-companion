import { Camera, Sparkles, Calendar, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

interface WardrobeHubProps {
  onNavigate: (view: 'upload' | 'generate' | 'calendar') => void;
}

const WardrobeHub = ({ onNavigate }: WardrobeHubProps) => {
  const [itemCount, setItemCount] = useState(0);
  const [outfitCount, setOutfitCount] = useState(0);

  useEffect(() => {
    fetchCounts();
  }, []);

  const fetchCounts = async () => {
    const { count: itemsCount, error: itemsError } = await supabase
      .from('wardrobe_items')
      .select('id', { count: 'exact', head: true });
    
    const { count: outfitsCount, error: outfitsError } = await supabase
      .from('outfits')
      .select('id', { count: 'exact', head: true });

    if (itemsError) console.error('Failed to count wardrobe_items:', itemsError);
    if (outfitsError) console.error('Failed to count outfits:', outfitsError);

    setItemCount(itemsCount || 0);
    setOutfitCount(outfitsCount || 0);
  };

  const cards = [
    {
      icon: Upload,
      title: "Upload your clothing items",
      description: "Click or upload to digitize your wardrobe.",
      action: () => onNavigate('upload'),
      disabled: false,
      emptyMessage: itemCount === 0 ? "Your wardrobe is empty. Add items (don't be lazy :P)" : null,
      gradient: "from-primary/20 to-primary/5"
    },
    {
      icon: Sparkles,
      title: "Generate Outfits",
      description: "Create complete looks from your items.",
      action: () => onNavigate('generate'),
      disabled: false,
      disabledTooltip: undefined,
      emptyMessage: itemCount === 0 ? "Add items or generate with AI suggestions." : null,
      gradient: "from-accent/20 to-accent/5"
    },
    {
      icon: Calendar,
      title: "Plan your looks",
      description: "Schedule outfits on your calendar.",
      action: () => onNavigate('calendar'),
      disabled: false,
      disabledTooltip: undefined,
      emptyMessage: outfitCount === 0 ? "No saved looks yet — you can still plan and generate inline." : null,
      gradient: "from-secondary/20 to-secondary/5"
    }
  ];

  return (
    <div className="flex flex-col h-full p-4 space-y-4 pb-safe">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-bold text-gradient-primary">Your Wardrobe</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Your closet, upgraded. Build, style, and plan your perfect looks.
        </p>
      </div>

      {/* Sly Copy */}
      <p className="text-[10px] sm:text-xs text-muted-foreground italic">
        Please don't be lazy — take pictures in good lighting or upload a clear photo :P
      </p>

      {/* Feature Cards */}
      <div className="flex-1 grid gap-3 overflow-y-auto">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className={`glass-card hover:glow-primary transition-all cursor-pointer relative overflow-hidden active:scale-[0.98] ${
                  card.disabled ? 'opacity-60' : ''
                }`}
                onClick={card.disabled ? undefined : card.action}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50`} />
                <CardHeader className="relative pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-card/50 backdrop-blur flex-shrink-0">
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg">{card.title}</CardTitle>
                      <CardDescription className="mt-0.5 text-xs sm:text-sm">
                        {card.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative pt-0">
                  {card.emptyMessage && (
                    <div className="mb-3 p-2.5 rounded-lg bg-muted/20 border border-border/50">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{card.emptyMessage}</p>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    className="w-full glow-accent min-h-[44px] text-sm"
                    onClick={card.action}
                  >
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Stats */}
      {itemCount > 0 && (
        <div className="flex gap-3 text-center flex-shrink-0">
          <div className="flex-1 p-3 glass-card rounded-xl">
            <p className="text-xl sm:text-2xl font-bold text-gradient-primary">{itemCount}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Items</p>
          </div>
          <div className="flex-1 p-3 glass-card rounded-xl">
            <p className="text-xl sm:text-2xl font-bold text-gradient-accent">{outfitCount}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Outfits</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WardrobeHub;
