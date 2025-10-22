import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, Check } from "lucide-react";

interface OnboardingData {
  name: string;
  gender: string;
  age: string;
  profession: string;
  styleVibes: string[];
}

interface OnboardingProps {
  onComplete: (data: OnboardingData) => void;
}

const styleVibes = [
  { id: "minimal", label: "Minimal & Modern", emoji: "🤍" },
  { id: "streetwear", label: "Streetwear Cool", emoji: "🧢" },
  { id: "chic", label: "Chic & Elegant", emoji: "✨" },
  { id: "bold", label: "Bold & Statement", emoji: "🔥" },
  { id: "athleisure", label: "Athleisure Everyday", emoji: "👟" },
  { id: "classic", label: "Classic & Timeless", emoji: "👔" },
];

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    gender: "",
    age: "",
    profession: "",
    styleVibes: [],
  });

  const toggleVibe = (vibeId: string) => {
    setData(prev => {
      const vibes = prev.styleVibes.includes(vibeId)
        ? prev.styleVibes.filter(v => v !== vibeId)
        : prev.styleVibes.length < 2
        ? [...prev.styleVibes, vibeId]
        : prev.styleVibes;
      return { ...prev, styleVibes: vibes };
    });
  };

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      localStorage.setItem("onboarding_completed", "true");
      localStorage.setItem("user_profile", JSON.stringify(data));
      onComplete(data);
    }
  };

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) return data.name && data.gender && data.age && data.profession;
    if (step === 2) return data.styleVibes.length > 0;
    return false;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        {step === 0 && (
          <div className="text-center space-y-6 animate-in fade-in duration-500">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center glow-primary">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gradient-primary mb-4">Hey there! 👋</h1>
              <p className="text-lg text-muted-foreground">
                I'm your new stylist bestie. Ready to upgrade your fashion game?
              </p>
            </div>
            <Button onClick={handleNext} className="glow-primary" size="lg">
              Let's Go!
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gradient-primary mb-2">Tell me about yourself</h2>
              <p className="text-sm text-muted-foreground">Just the basics to personalize your style</p>
            </div>

            <div className="glass-card p-6 rounded-2xl space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">What's your name?</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  className="glass-card border-border/50"
                />
              </div>

              <div className="space-y-2">
                <Label>Gender</Label>
                <RadioGroup value={data.gender} onValueChange={(value) => setData({ ...data, gender: value })}>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="male" />
                      <Label htmlFor="male" className="cursor-pointer">Male</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="female" />
                      <Label htmlFor="female" className="cursor-pointer">Female</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="other" id="other" />
                      <Label htmlFor="other" className="cursor-pointer">Other</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="Your age"
                  value={data.age}
                  onChange={(e) => setData({ ...data, age: e.target.value })}
                  className="glass-card border-border/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profession">Profession</Label>
                <Input
                  id="profession"
                  placeholder="What do you do?"
                  value={data.profession}
                  onChange={(e) => setData({ ...data, profession: e.target.value })}
                  className="glass-card border-border/50"
                />
              </div>
            </div>

            <Button onClick={handleNext} disabled={!canProceed()} className="w-full glow-primary" size="lg">
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gradient-primary mb-2">What's your vibe?</h2>
              <p className="text-sm text-muted-foreground">Pick 1-2 styles that represent you</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {styleVibes.map((vibe) => {
                const isSelected = data.styleVibes.includes(vibe.id);
                return (
                  <button
                    key={vibe.id}
                    onClick={() => toggleVibe(vibe.id)}
                    className={`glass-card p-6 rounded-2xl text-center space-y-3 transition-all ${
                      isSelected
                        ? "border-2 border-primary glow-primary scale-105"
                        : "border border-border/50 hover:border-accent/50"
                    }`}
                  >
                    <div className="text-4xl">{vibe.emoji}</div>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{vibe.label}</p>
                      {isSelected && (
                        <div className="flex items-center justify-center gap-1 text-primary text-xs">
                          <Check className="w-3 h-3" />
                          <span>Selected</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <Button onClick={handleNext} disabled={!canProceed()} className="w-full glow-primary" size="lg">
              Finish Setup
            </Button>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="flex justify-center gap-2 mt-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? "w-8 bg-primary" : i < step ? "w-2 bg-primary/50" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
