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
    const { data: items } = await supabase
      .from('wardrobe_items')
      .select('id', { count: 'exact', head: true });
    
    const { data: outfits } = await supabase
      .from('outfits')
      .select('id', { count: 'exact', head: true });

    setItemCount(items?.length || 0);
    setOutfitCount(outfits?.length || 0);
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
      disabled: itemCount === 0,
      disabledTooltip: "Add a few items to start.",
      emptyMessage: itemCount === 0 ? "Add items or save a look to generate outfits." : null,
      gradient: "from-accent/20 to-accent/5"
    },
    {
      icon: Calendar,
      title: "Plan your looks",
      description: "Schedule outfits on your calendar.",
      action: () => onNavigate('calendar'),
      disabled: itemCount === 0 && outfitCount === 0,
      disabledTooltip: "Add items or save a look to plan outfits.",
      emptyMessage: itemCount === 0 && outfitCount === 0 ? "Add items or save a look to plan outfits." : null,
      gradient: "from-secondary/20 to-secondary/5"
    }
  ];

  return (
    <div className="flex flex-col h-full p-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-gradient-primary">Your Wardrobe</h2>
        <p className="text-sm text-muted-foreground">
          Your closet, upgraded. Build, style, and plan your perfect looks.
        </p>
      </div>

      {/* Sly Copy */}
      <p className="text-xs text-muted-foreground italic">
        Please don't be lazy — take pictures in good lighting or upload a clear photo :P
      </p>

      {/* Feature Cards */}
      <div className="flex-1 grid gap-4">
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
                className={`glass-card hover:glow-primary transition-all cursor-pointer relative overflow-hidden ${
                  card.disabled ? 'opacity-60' : ''
                }`}
                onClick={card.disabled ? undefined : card.action}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50`} />
                <CardHeader className="relative">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-card/50 backdrop-blur">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{card.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {card.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  {card.emptyMessage && (
                    <div className="mb-4 p-3 rounded-lg bg-muted/20 border border-border/50">
                      <p className="text-xs text-muted-foreground">{card.emptyMessage}</p>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    className="w-full glow-accent"
                    disabled={card.disabled}
                    title={card.disabled ? card.disabledTooltip : undefined}
                  >
                    {card.disabled ? card.disabledTooltip : 'Get Started'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Stats */}
      {itemCount > 0 && (
        <div className="flex gap-4 text-center">
          <div className="flex-1 p-3 glass-card rounded-xl">
            <p className="text-2xl font-bold text-gradient-primary">{itemCount}</p>
            <p className="text-xs text-muted-foreground">Items</p>
          </div>
          <div className="flex-1 p-3 glass-card rounded-xl">
            <p className="text-2xl font-bold text-gradient-accent">{outfitCount}</p>
            <p className="text-xs text-muted-foreground">Outfits</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WardrobeHub;
