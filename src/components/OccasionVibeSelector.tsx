import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Briefcase, Coffee, Heart, Sparkles, Users, Sun, TrendingUp, Dumbbell } from "lucide-react";
import { useState } from "react";

interface OccasionVibeSelectorProps {
  isOpen: boolean;
  currentOccasion: string;
  currentVibe: string;
  onApply: (occasion: string, vibe: string) => void;
  onClose: () => void;
}

const occasions = [
  { value: "Work", icon: Briefcase },
  { value: "Casual", icon: Coffee },
  { value: "Party", icon: Sparkles },
  { value: "Date", icon: Heart },
  { value: "Festive", icon: Users },
  { value: "Brunch", icon: Sun },
  { value: "Street", icon: TrendingUp },
  { value: "Athleisure", icon: Dumbbell },
];

const vibes = ["Chill", "Sharp", "Bold", "Elegant", "Playful", "Minimal"];

export const OccasionVibeSelector = ({
  isOpen,
  currentOccasion,
  currentVibe,
  onApply,
  onClose,
}: OccasionVibeSelectorProps) => {
  const [selectedOccasion, setSelectedOccasion] = useState(currentOccasion);
  const [selectedVibe, setSelectedVibe] = useState(currentVibe);

  const handleApply = () => {
    onApply(selectedOccasion, selectedVibe);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl border-t border-border/50 max-h-[85vh] overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border/50">
                <h3 className="text-2xl font-bold text-foreground">
                  Customize Your Check
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Occasions */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Occasion
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {occasions.map(({ value, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={selectedOccasion === value ? "default" : "outline"}
                      className="h-auto flex-col gap-2 py-4 transition-all"
                      onClick={() => setSelectedOccasion(value)}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-sm font-semibold">{value}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Vibes */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Vibe
                </label>
                <div className="flex flex-wrap gap-2">
                  {vibes.map((vibe) => (
                    <Badge
                      key={vibe}
                      variant={selectedVibe === vibe ? "default" : "outline"}
                      className="cursor-pointer px-4 py-2 text-sm transition-all hover:scale-105"
                      onClick={() => setSelectedVibe(vibe)}
                    >
                      {vibe}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Apply Button */}
              <Button
                onClick={handleApply}
                className="w-full h-12 text-base"
                size="lg"
              >
                Apply Changes
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};