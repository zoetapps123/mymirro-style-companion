import { Calendar, DoorOpen, Sparkles, Shirt } from "lucide-react";
import { useEffect } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";

interface WardrobeComingSoonProps {
  onBack: () => void;
  onNavigate: (view: 'items' | 'suggestion' | 'calendar' | 'lookbook') => void;
}

const WardrobeComingSoon = ({ onBack, onNavigate }: WardrobeComingSoonProps) => {
  const { trackScreenView } = useAnalytics();
  const features = [
    { icon: DoorOpen, title: "Your\nCloset", view: 'items' as const, active: false },
    { icon: Sparkles, title: "Outfits", view: 'suggestion' as const, active: false },
    { icon: Calendar, title: "Plan Your\nLook", view: 'calendar' as const, active: true },
    { icon: Shirt, title: "Your\nLookbook", view: 'lookbook' as const, active: false },
  ];

  // Track screen view on mount
  useEffect(() => {
    trackScreenView(
      'wardrobe-calendar-placeholder',
      { view: 'calendar' },
      '/app/wardrobe/calendar',
      '/app/wardrobe/calendar'
    );
  }, [trackScreenView]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Feature Icons */}
      <div className="px-4 pt-6 pb-4">
        <div className="grid grid-cols-4 gap-4">
          {features.map((feature) => {
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

      {/* Coming Soon Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Calendar className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Coming Soon</h2>
        <p className="text-muted-foreground max-w-sm">
          We're working on bringing you an amazing calendar feature to plan your looks. Stay tuned!
        </p>
      </div>
    </div>
  );
};

export default WardrobeComingSoon;
