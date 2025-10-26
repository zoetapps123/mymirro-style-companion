import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingData {
  name: string;
  gender: string;
}

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [data, setData] = useState<OnboardingData>({
    name: "",
    gender: "",
  });

  const genderOptions = [
    { id: "male", label: "♂️ Male" },
    { id: "female", label: "♀️ Female" },
    { id: "non-binary", label: "🧑 Non-Binary" },
    { id: "prefer-not-to-say", label: "💫 Prefer not to say" },
  ];

  const handleSubmit = async () => {
    localStorage.setItem("onboard_name", data.name);
    localStorage.setItem("onboard_gender", data.gender);
    localStorage.setItem("onboardingComplete", "true");
    
    // Also store in Supabase user metadata for persistence across devices
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.auth.updateUser({
        data: {
          name: data.name,
          gender: data.gender,
          onboarding_complete: true
        }
      });
    }
    
    onComplete();
  };

  const canProceed = data.name.trim() && data.gender;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="glass-card rounded-2xl p-8 space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gradient-primary">
              Let's Get to Know You
            </h1>
            <p className="text-muted-foreground">
              Tell us a bit about yourself to personalize your experience
            </p>
          </div>

          <div className="space-y-6">
            {/* Name Input */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-2"
            >
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Your Name
              </label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={data.name}
                onChange={(e) => {
                  const capitalized = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
                  setData({ ...data, name: capitalized });
                }}
                className="glass-card border-border/50 h-12"
                maxLength={50}
              />
            </motion.div>

            {/* Gender Selection */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              <label className="text-sm font-medium">Select Your Gender</label>
              <div className="grid grid-cols-2 gap-3">
                {genderOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setData({ ...data, gender: option.id })}
                    className={`p-4 rounded-xl border-2 transition-all min-h-[60px] ${
                      data.gender === option.id
                        ? "border-primary bg-primary/10 glow-primary"
                        : "border-border/50 hover:border-primary/50"
                    }`}
                  >
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canProceed}
            className="w-full glow-primary text-lg h-12"
          >
            Start My Fashion Journey ✨
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;
