import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Briefcase, Coffee, Heart, Sparkles, Users, Plane, UserCheck } from "lucide-react";

interface OccasionModalProps {
  open: boolean;
  onSelect: (occasion: string) => void;
  onClose: () => void;
}

const occasions = [
  { value: "Casual Day Out", icon: Coffee, color: "text-cyan-500" },
  { value: "Office", icon: Briefcase, color: "text-blue-500" },
  { value: "Dinner Date", icon: Heart, color: "text-pink-500" },
  { value: "Party", icon: Sparkles, color: "text-purple-500" },
  { value: "Wedding", icon: Users, color: "text-rose-500" },
  { value: "Travel", icon: Plane, color: "text-teal-500" },
  { value: "Interview", icon: UserCheck, color: "text-indigo-500" }
];

export const OutfitCheckOccasionModal = ({ open, onSelect, onClose }: OccasionModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Where are you headed?</DialogTitle>
          <DialogDescription className="text-center">
            Choose your occasion for a smarter style check
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {occasions.map(({ value, icon: Icon, color }) => (
            <Button
              key={value}
              variant="outline"
              className="h-auto flex-col gap-3 py-4 hover:border-primary hover:bg-primary/5"
              onClick={() => {
                onSelect(value);
                onClose();
              }}
            >
              <Icon className={`w-8 h-8 ${color}`} />
              <span className="text-sm font-medium">{value}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
