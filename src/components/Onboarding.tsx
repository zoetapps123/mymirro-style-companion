import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingData {
  name: string;
  gender: string;
  ageRange: string;
}

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [data, setData] = useState<OnboardingData>({
    name: "",
    gender: "",
    ageRange: "",
  });

  const genderOptions = [
    { id: "female", label: "Female" },
    { id: "male", label: "Male" },
    { id: "other", label: "Other" },
  ];

  const ageRanges = [
    { id: "<18", label: "<18" },
    { id: "18-25", label: "18-25" },
    { id: "26-35", label: "26-35" },
    { id: "36-45", label: "36-45" },
  ];

  const handleSubmit = async () => {
    localStorage.setItem("onboard_name", data.name);
    localStorage.setItem("onboard_gender", data.gender);
    localStorage.setItem("onboard_age_range", data.ageRange);
    
    // Also store in Supabase user metadata and profiles table
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.auth.updateUser({
        data: {
          name: data.name,
          gender: data.gender,
          age_range: data.ageRange,
        }
      });

      // Update profiles table
      await supabase.from('user_profiles').upsert({
        id: user.id,
        name: data.name,
        gender: data.gender,
        age_range: data.ageRange,
      });
    }
    
    onComplete();
  };

  const canProceed = data.name.trim() && data.gender && data.ageRange;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="space-y-8">
          {/* Logo */}
          <h1 className="text-4xl font-bold text-center" style={{ fontFamily: 'cursive' }}>
            MyMirro
          </h1>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Hey there, Style Icon!</h2>
            <p className="text-muted-foreground">
              Start by telling us a bit about you.
            </p>
          </div>

          <div className="space-y-6">
            {/* Name Input */}
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="What should we call you?"
                value={data.name}
                onChange={(e) => {
                  const capitalized = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
                  setData({ ...data, name: capitalized });
                }}
                className="h-12 bg-white border-gray-200 text-base"
                maxLength={50}
              />
            </div>

            {/* Gender Selection */}
            <div className="space-y-3">
              <label className="text-xl font-bold">Gender</label>
              <div className="grid grid-cols-3 gap-3">
                {genderOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setData({ ...data, gender: option.id })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      data.gender === option.id
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Age Selection */}
            <div className="space-y-3">
              <label className="text-xl font-bold">Age</label>
              <div className="grid grid-cols-3 gap-3">
                {ageRanges.map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setData({ ...data, ageRange: range.id })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      data.ageRange === range.id
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className="text-sm font-medium">{range.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canProceed}
            className="w-full h-14 bg-black hover:bg-black/90 text-white text-lg font-semibold rounded-2xl mt-8"
          >
            Next
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;
