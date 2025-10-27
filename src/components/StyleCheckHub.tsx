import { Target, Swords } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
interface StyleCheckHubProps {
  onNavigate: (view: 'outfit-check' | 'outfit-battle') => void;
}
const StyleCheckHub = ({
  onNavigate
}: StyleCheckHubProps) => {
  const features = [{
    icon: Target,
    title: "Outfit Check",
    description: "Get a pro score and quick fixes for your look.",
    action: () => onNavigate('outfit-check'),
    gradient: "from-accent/20 to-accent/5",
    buttonText: "Start Check"
  }, {
    icon: Swords,
    title: "Outfit Battle",
    description: "Pit outfits head-to-head. Winner gets the crown.",
    action: () => onNavigate('outfit-battle'),
    gradient: "from-primary/20 to-primary/5",
    buttonText: "Let's Battle"
  }];
  return <div className="flex flex-col h-full p-4 space-y-4 pb-safe">

      <p className="text-[10px] sm:text-xs text-muted-foreground italic">
        Please use a clear full-length photo in good lighting.
      </p>

      <div className="flex-1 grid gap-3 overflow-y-auto">
        {features.map((feature, index) => {
        const Icon = feature.icon;
        return <motion.div key={feature.title} initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: index * 0.1
        }}>
              <Card className="glass-card hover:glow-accent transition-all cursor-pointer relative overflow-hidden h-full active:scale-[0.98]" onClick={feature.action}>
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-50`} />
                <CardHeader className="relative pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-card/50 backdrop-blur flex-shrink-0">
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg sm:text-xl">{feature.title}</CardTitle>
                      <CardDescription className="mt-1 text-xs sm:text-sm">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative pt-0 pb-3">
                  <Button variant="secondary" className="w-full glow-accent min-h-[44px] text-sm">
                    {feature.buttonText}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>;
      })}
      </div>
    </div>;
};
export default StyleCheckHub;