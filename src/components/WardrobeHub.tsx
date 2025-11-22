import { DoorOpen, Sparkles, Calendar, Shirt } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";

interface WardrobeHubProps {
  onNavigate: (view: 'upload' | 'generate' | 'calendar' | 'items' | 'suggestion' | 'lookbook') => void;
}
const WardrobeHub = ({ onNavigate }: WardrobeHubProps) => {
  const { trackScreenView } = useAnalytics();
  
  // Track screen view on mount
  useEffect(() => {
    trackScreenView(
      'wardrobe-hub',
      { tab: 'wardrobe' },
      '/app/wardrobe/hub',
      '/app/wardrobe/hub'
    );
  }, [trackScreenView]);
  
  const features = [
    {
      icon: DoorOpen,
      title: "Your Closet",
      subtitle: "",
      action: () => onNavigate('items'),
      active: true,
    },
    {
      icon: Sparkles,
      title: "Outfits",
      subtitle: "",
      action: () => onNavigate('suggestion'),
      active: false,
    },
    {
      icon: Calendar,
      title: "Plan Your Look",
      subtitle: "",
      action: () => onNavigate('calendar'),
      active: false,
    },
    {
      icon: Shirt,
      title: "Your Lookbook",
      subtitle: "",
      action: () => onNavigate('lookbook'),
      active: false,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Feature Icons */}
      <div className="px-4 pt-6 pb-4">
        <div className="grid grid-cols-4 gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isActive = index === 0;
            return (
              <motion.button
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={feature.action}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    isActive
                      ? "bg-primary border-2 border-primary"
                      : "bg-background border-2 border-border"
                  }`}
                >
                  <Icon
                    className={`w-7 h-7 ${
                      isActive ? "text-primary-foreground" : "text-primary"
                    }`}
                  />
                </div>
                <span className="text-xs font-medium text-center leading-tight">
                  {feature.title}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WardrobeHub;