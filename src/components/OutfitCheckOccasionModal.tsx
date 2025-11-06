import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Briefcase, Coffee, Heart, Sparkles, Users } from "lucide-react";

interface OccasionModalProps {
  open: boolean;
  onSelect: (occasion: string) => void;
  onClose: () => void;
}

const occasions = [
  { value: "Work", icon: Briefcase, color: "text-blue-500" },
  { value: "Casual", icon: Coffee, color: "text-cyan-500" },
  { value: "Date", icon: Heart, color: "text-pink-500" },
  { value: "Party", icon: Sparkles, color: "text-purple-500" },
  { value: "Formal", icon: Users, color: "text-indigo-500" },
];

export const OutfitCheckOccasionModal = ({ open, onSelect, onClose }: OccasionModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md animate-slide-in-right">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Where are you heading?</DialogTitle>
          <DialogDescription className="text-center">
            Choose your occasion for a smarter style check
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {occasions.map(({ value, icon: Icon, color }) => (
            <Button
              key={value}
              variant="outline"
              className="h-auto flex-col gap-3 py-5 hover:border-primary hover:bg-primary/10 transition-all active:scale-95"
              onClick={() => {
                onSelect(value);
              }}
            >
              <Icon className={`w-10 h-10 ${color}`} />
              <span className="text-sm font-semibold">{value}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
