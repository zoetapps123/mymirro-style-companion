import { Target, Swords } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface StyleCheckHubProps {
  onNavigate: (view: 'outfit-check' | 'outfit-battle') => void;
}

const StyleCheckHub = ({ onNavigate }: StyleCheckHubProps) => {
  const features = [
    {
      icon: Target,
      title: "Outfit Check",
      description: "Get a pro score and quick fixes for your look.",
      action: () => onNavigate('outfit-check'),
      gradient: "from-accent/20 to-accent/5"
    },
    {
      icon: Swords,
      title: "Outfit Battle",
      description: "Pit outfits head-to-head. Winner gets the crown.",
      action: () => onNavigate('outfit-battle'),
      gradient: "from-primary/20 to-primary/5"
    }
  ];

  return (
    <div className="flex flex-col h-full p-4 space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-gradient-accent">Style Check</h2>
        <p className="text-sm text-muted-foreground">
          Proof your outfit in 30 seconds. Honest score. Easy fixes.
        </p>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Please use a clear full-length photo in good lighting.
      </p>

      <div className="flex-1 grid gap-4">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="glass-card hover:glow-accent transition-all cursor-pointer relative overflow-hidden h-full"
                onClick={feature.action}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-50`} />
                <CardHeader className="relative">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-card/50 backdrop-blur">
                      <Icon className="w-6 h-6 text-accent" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                      <CardDescription className="mt-2 text-base">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <Button variant="secondary" className="w-full glow-accent">
                    Start Check
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default StyleCheckHub;
