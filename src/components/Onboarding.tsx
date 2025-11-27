import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { trackPageView } from "@/lib/mixpanel";
import { SCREEN_NAMES, SCREEN_PATHS } from "@/lib/screenRoutes";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent, setUserProperties, identifyUser } from "@/lib/mixpanel";

interface OnboardingData {
  name: string;
  gender: string;
  ageRange: string;
}

interface OnboardingProps {
  onComplete: () => void;
  onBack: () => void;
}

const Onboarding = ({ onComplete, onBack }: OnboardingProps) => {
  const { trackCustom, startFlow, trackFlowStep, completeFlow } = useAnalytics();
  const { toast } = useToast();
  const [data, setData] = useState<OnboardingData>({
    name: "",
    gender: "",
    ageRange: "",
  });

  // Track onboarding started
  useEffect(() => {
    startFlow('onboarding');
    trackCustom('onboarding_started', {}, 'Onboarding - Started');
    trackPageView(SCREEN_NAMES.ONBOARDING, SCREEN_PATHS.ONBOARDING);
  }, [trackCustom, startFlow]);

  const genderOptions = [
    { id: "female", label: "Female" },
    { id: "male", label: "Male" },
    { id: "other", label: "Other" },
  ];

  const ageRanges = [
    { id: "<18", label: "<18" },
    { id: "18-21", label: "18–21" },
    { id: "22-26", label: "22–26" },
    { id: "27-30", label: "27–30" },
    { id: ">30", label: ">30" },
  ];

  const handleSubmit = async () => {
    try {
      trackFlowStep('onboarding', 'submitting_data');
      
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

      completeFlow('onboarding', true, {
        gender: data.gender,
        age_range: data.ageRange,
      });
      
      // Track onboarding completed
      trackCustom('onboarding_completed', {
        gender: data.gender,
        age_range: data.ageRange,
      }, 'user_action:complete_onboarding');

      // Mixpanel: Track onboarding completion and set user properties
      trackEvent('onboarding_completed', {
        gender: data.gender,
        age_range: data.ageRange,
      });
      
      if (user) {
        setUserProperties({
          $name: data.name,
          gender: data.gender,
          age_range: data.ageRange,
        });
        
        // Re-identify user with complete profile to ensure all properties are synced
        identifyUser({
          ...user,
          user_metadata: {
            ...user.user_metadata,
            name: data.name,
            gender: data.gender,
            age_range: data.ageRange,
          }
        });
      }

      onComplete();
    } catch (error) {
      console.error("Error saving profile:", error);
      
      completeFlow('onboarding', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      toast({
        title: "Failed to save profile",
        description: "Please try again.",
        variant: "destructive"
      });
    }
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
          <div className="text-center pt-4">
            <img src={logo} alt="MyMirro" className="h-16 mx-auto" />
          </div>
          
          {/* Back Button */}
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/50 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-gray-900">Hey there, Style Icon!</h2>
            <p className="text-gray-600">
              Start by telling us a bit about you.
            </p>
          </div>

          <div className="space-y-4">
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
                  className="h-12 bg-white border-gray-200 text-gray-900 text-base placeholder:text-[#A7A7A7] rounded-xl shadow-sm"
                  maxLength={50}
              />
            </div>

            {/* Gender Selection */}
            <div className="space-y-2 pt-4">
              <label className="text-base font-semibold text-gray-900 block text-left">Gender</label>
              <div className="grid grid-cols-3 gap-3">
                {genderOptions.map((option) => (
            <motion.button
                key={option.id}
                onClick={() => setData({ ...data, gender: option.id })}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                  data.gender === option.id
                    ? "border-black bg-black text-white shadow-lg"
                    : "border-gray-200 bg-white text-gray-900 hover:border-gray-300"
                }`}
              >
                <span className="text-sm font-medium">{option.label}</span>
              </motion.button>
                ))}
              </div>
            </div>

            {/* Age Selection */}
            <div className="space-y-2 pt-4">
              <label className="text-base font-semibold text-gray-900 block text-left">Age</label>
              <div className="grid grid-cols-3 gap-2">
                {ageRanges.map((range) => (
                  <motion.button
                    key={range.id}
                    onClick={() => setData({ ...data, ageRange: range.id })}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-3 rounded-full border-2 transition-all duration-300 ${
                      data.ageRange === range.id
                        ? "border-black bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                        : "border-gray-200 bg-white text-gray-900 hover:border-gray-400"
                    }`}
                  >
                    <span className="text-sm font-medium">{range.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleSubmit}
              disabled={!canProceed}
              className="w-full h-14 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-semibold rounded-2xl mt-8 shadow-lg"
            >
              Next
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;
