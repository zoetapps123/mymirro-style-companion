import { Calendar } from "lucide-react";

interface WardrobeComingSoonProps {
  onBack: () => void;
}

const WardrobeComingSoon = ({ onBack }: WardrobeComingSoonProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Calendar className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-3">Coming Soon</h2>
      <p className="text-muted-foreground max-w-sm">
        We're working on bringing you an amazing calendar feature to plan your looks. Stay tuned!
      </p>
    </div>
  );
};

export default WardrobeComingSoon;
