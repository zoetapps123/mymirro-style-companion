import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingData {
  name: string;
  gender: string;
  location: string;
  weather?: {
    temp: number;
    weather: string;
    icon: string;
    humidity: number;
    season: string;
  };
}

interface CityOption {
  name: string;
  country: string;
  state?: string;
  temp: number | null;
  weather: string | null;
  icon: string;
  humidity?: number;
  season?: string;
}

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [data, setData] = useState<OnboardingData>({
    name: "",
    gender: "",
    location: "",
  });
  const [cityQuery, setCityQuery] = useState("");
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [searchingCities, setSearchingCities] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const genderOptions = [
    { id: "male", label: "♂️ Male" },
    { id: "female", label: "♀️ Female" },
    { id: "non-binary", label: "🧑 Non-Binary" },
    { id: "prefer-not-to-say", label: "💫 Prefer not to say" },
  ];

  // Debounced city search
  useEffect(() => {
    if (cityQuery.length < 2) {
      setCityOptions([]);
      setShowCityDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingCities(true);
      try {
        const { data, error } = await supabase.functions.invoke('weather-search', {
          body: { query: cityQuery }
        });

        if (!error && data?.cities) {
          setCityOptions(data.cities);
          setShowCityDropdown(true);
        }
      } catch (error) {
        console.error('Error searching cities:', error);
      } finally {
        setSearchingCities(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [cityQuery]);

  const selectCity = (city: CityOption) => {
    const locationString = city.state 
      ? `${city.name}, ${city.state}, ${city.country}`
      : `${city.name}, ${city.country}`;
    
    setData({ 
      ...data, 
      location: locationString,
      weather: city.temp !== null ? {
        temp: city.temp,
        weather: city.weather!,
        icon: city.icon,
        humidity: city.humidity || 0,
        season: city.season || ''
      } : undefined
    });
    setCityQuery(locationString);
    setShowCityDropdown(false);
  };

  const handleSubmit = () => {
    localStorage.setItem("onboardingData", JSON.stringify(data));
    localStorage.setItem("onboardingComplete", "true");
    localStorage.setItem("isFirstLogin", "true");
    onComplete();
  };

  const canProceed = data.name.trim() && data.gender && data.location.trim();

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
                className="glass-card border-border/50"
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
                    className={`p-4 rounded-xl border-2 transition-all ${
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

            {/* Location Input with Weather */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-2 relative"
            >
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Your Location
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search your city..."
                  value={cityQuery}
                  onChange={(e) => {
                    setCityQuery(e.target.value);
                    setData({ ...data, location: e.target.value });
                  }}
                  onFocus={() => cityQuery.length >= 2 && setShowCityDropdown(true)}
                  className="glass-card border-border/50"
                />
                {searchingCities && (
                  <Loader2 className="w-4 h-4 absolute right-3 top-3 animate-spin text-muted-foreground" />
                )}
              </div>

              <AnimatePresence>
                {showCityDropdown && cityOptions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 w-full mt-1 glass-card border border-border/50 rounded-lg overflow-hidden max-h-64 overflow-y-auto"
                  >
                    {cityOptions.map((city, index) => (
                      <motion.button
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => selectCity(city)}
                        className="w-full p-3 hover:bg-primary/10 transition-colors text-left flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {city.name}
                            {city.state && `, ${city.state}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{city.country}</p>
                        </div>
                        {city.temp !== null && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xl">{city.icon}</span>
                            <span className="text-sm font-medium">{city.temp}°C</span>
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
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
