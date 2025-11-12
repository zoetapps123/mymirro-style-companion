import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";
import slide1 from "@/assets/slide-1.png";
import slide2 from "@/assets/slide-2.png";
import slide3 from "@/assets/slide-3.png";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PhoneAuthProps {
  isSignUp: boolean;
  onBack: () => void;
  onSuccess: () => void;
}

const phoneSchema = z.string().regex(/^\d{10}$/, "Please enter a valid 10-digit phone number");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

// Utility function to generate non-predictable email from phone number
const generateSecureEmail = async (phone: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(`mymirro_${phone}_secure`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hashHex.substring(0, 32)}@mymirro.app`;
};

// Utility function to hash phone number for privacy
const hashPhoneNumber = async (phone: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(phone);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const PhoneAuth = ({ isSignUp, onBack, onSuccess }: PhoneAuthProps) => {
  const [loading, setLoading] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const { toast } = useToast();

  const slides = [
    {
      title: "Get personalized style advice",
      image: slide1
    },
    {
      title: "Organize and style your wardrobe",
      image: slide2
    },
    {
      title: "Rate your outfits with AI",
      image: slide3
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [slides.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate inputs
    const phoneValidation = phoneSchema.safeParse(phone);
    if (!phoneValidation.success) {
      setError(phoneValidation.error.errors[0].message);
      return;
    }

    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      setError(passwordValidation.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const fullPhone = `${countryCode}${phone}`;
      // Generate secure, non-predictable email from phone number
      const email = await generateSecureEmail(phone);
      
      if (isSignUp) {
        const { error: signUpError, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              phone: fullPhone,
            }
          }
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            setError("This phone number is already registered. Please log in instead.");
          } else {
            setError(signUpError.message);
          }
          return;
        }

        // Track Snapchat Pixel signup event
        try {
          const hashedPhone = await hashPhoneNumber(fullPhone);
          if (typeof window !== 'undefined' && (window as any).snaptr) {
            (window as any).snaptr('track', 'SIGN_UP', {
              'sign_up_method': 'phone',
              'uuid_c1': data.user?.id || '',
              'user_phone_number': fullPhone,
              'user_hashed_phone_number': hashedPhone
            });
          }
        } catch (err) {
          console.error('Snap Pixel tracking error:', err);
        }

        localStorage.setItem("last_login", Date.now().toString());
        localStorage.setItem("user_phone", fullPhone);

        toast({
          title: "Welcome to MyMirro! 🎉",
          description: "Your fashion journey starts now",
        });

        setTimeout(() => {
          onSuccess();
        }, 800);

      } else {
        // Sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError("Invalid phone number or password. Please try again.");
          return;
        }

        localStorage.setItem("last_login", Date.now().toString());
        localStorage.setItem("user_phone", fullPhone);
        localStorage.setItem("is_signin", "true");

        toast({
          title: "Welcome back! 👋",
          description: "Your fashion journey continues",
        });

        setTimeout(() => {
          onSuccess();
        }, 800);
      }

    } catch (err: any) {
      console.error('Auth error:', err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-200 via-purple-300 to-pink-200 p-6">
      {/* Logo */}
      <div className="text-center pt-4 pb-4">
        <img src={logo} alt="MyMirro" className="h-16 mx-auto" />
      </div>

      {/* Carousel */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 max-w-md mx-auto w-full">
        <div 
          className="relative w-full flex-1 min-h-[300px] max-h-[500px] flex items-center justify-center"
          onTouchStart={(e) => {
            const touchStartX = e.touches[0].clientX;
            e.currentTarget.setAttribute('data-touch-start', touchStartX.toString());
          }}
          onTouchEnd={(e) => {
            const touchStartX = parseFloat(e.currentTarget.getAttribute('data-touch-start') || '0');
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;
            
            if (Math.abs(diff) > 50) {
              if (diff > 0) {
                // Swipe left - next slide
                setCurrentSlide((prev) => (prev + 1) % slides.length);
              } else {
                // Swipe right - previous slide
                setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
              }
            }
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              className="w-full h-full flex items-center justify-center"
            >
              <img 
                src={slides[currentSlide].image} 
                alt={slides[currentSlide].title} 
                className="w-full h-full object-contain"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Slide Indicators */}
        <div className="flex gap-2">
          {slides.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => setCurrentSlide(index)}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? 'w-12 bg-gradient-to-r from-purple-600 to-pink-600' 
                  : 'w-2 bg-white/50'
              }`}
            />
          ))}
        </div>

        {/* Title - Dynamic based on slide */}
        <motion.p 
          key={`title-${currentSlide}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-white text-xl font-semibold text-center px-4"
        >
          {slides[currentSlide].title}
        </motion.p>
      </div>

      {/* Form Section */}
      <div className="space-y-4 pb-safe max-w-md mx-auto w-full">

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Phone Number */}
          <div className="flex gap-2">
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger className="w-20 h-14 bg-white/90 backdrop-blur border-0 rounded-2xl text-[#6B4D82]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="+91">+91</SelectItem>
                <SelectItem value="+1">+1</SelectItem>
                <SelectItem value="+44">+44</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                setError("");
              }}
              className="h-14 bg-white/90 backdrop-blur border-0 rounded-2xl text-[#6B4D82] placeholder:text-[#A7A7A7] text-base"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              className="h-14 bg-white/90 backdrop-blur border-0 rounded-2xl text-[#6B4D82] placeholder:text-[#A7A7A7] pr-12 text-base"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A7A7A7]"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {!isSignUp && (
            <div className="text-right">
              <button
                type="button"
                onClick={onBack}
                className="text-[#6B4D82] text-sm font-medium hover:underline"
              >
                Forgot your password?
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              type="submit"
              className="w-full h-14 bg-black hover:bg-black/90 text-white text-lg font-semibold rounded-2xl shadow-xl"
              disabled={loading}
            >
              {loading ? "Processing..." : isSignUp ? "Sign up" : "Log in"}
            </Button>
          </motion.div>
        </form>

        <motion.button
          onClick={onBack}
          whileHover={{ scale: 1.05 }}
          className="w-full text-[#6B4D82] text-base font-semibold hover:underline underline-offset-4 transition-all"
        >
          {isSignUp ? "Already have an account" : "Create new account"}
        </motion.button>
      </div>
    </div>
  );
};

export default PhoneAuth;
