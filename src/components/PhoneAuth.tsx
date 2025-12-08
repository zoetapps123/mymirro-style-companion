import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";
import aiBlob from "@/assets/ai-blob.png";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import { z } from "zod";
import { identifyUser, trackEvent, trackPageView } from "@/lib/mixpanel";
import { SCREEN_NAMES, SCREEN_PATHS } from "@/lib/screenRoutes";
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
const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

// Utility function to hash phone number for privacy
const hashPhoneNumber = async (phone: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(phone);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const PhoneAuth = ({ isSignUp, onBack, onSuccess }: PhoneAuthProps) => {
  const { trackCustom, trackScreenView } = useAnalytics();
  const [loading, setLoading] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    trackScreenView('auth', {}, '/', '/');
    trackPageView(SCREEN_NAMES.AUTH_LOGIN, SCREEN_PATHS.AUTH_LOGIN);
  }, [trackScreenView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate phone
    const phoneValidation = phoneSchema.safeParse(phone);
    if (!phoneValidation.success) {
      setError(phoneValidation.error.errors[0].message);
      return;
    }

    // Validate email only for signup
    if (isSignUp) {
      const emailValidation = emailSchema.safeParse(email);
      if (!emailValidation.success) {
        setError(emailValidation.error.errors[0].message);
        return;
      }
    }

    // Validate password
    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      setError(passwordValidation.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const fullPhone = `${countryCode}${phone}`;
      
      if (isSignUp) {
        const { error: signUpError, data } = await supabase.auth.signUp({
          email: email.trim(),
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
            setError("This email is already registered. Please log in instead.");
          } else {
            setError(signUpError.message);
          }
          return;
        }

        // Save email and phone to user_profiles for login lookup
        if (data.user) {
          await supabase.from('user_profiles').upsert({
            id: data.user.id,
            email: email.trim(),
            phone: fullPhone,
          }, { onConflict: 'id' });
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
        
        // Track successful signup
        trackCustom('auth_signup_success', {
          method: 'phone',
          country_code: countryCode,
        }, 'user_action:signup', '/auth/signup');

        // Mixpanel: Identify user and track signup
        if (data.user) {
          identifyUser(data.user);
          trackEvent('auth_signup_success', {
            method: 'phone',
            country_code: countryCode,
          });
        }

        toast({
          title: "Welcome to MyMirro! 🎉",
          description: "Your fashion journey starts now",
        });

        setTimeout(() => {
          onSuccess();
        }, 800);

      } else {
        // Sign in - look up email from phone number
        const { data: userData, error: lookupError } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('phone', fullPhone)
          .maybeSingle();

        if (lookupError || !userData || !userData.email) {
          setError("Phone number not found. Please sign up first.");
          return;
        }

        const userEmail = userData.email as string;

        const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password,
        });

        if (signInError) {
          setError("Invalid phone number or password. Please try again.");
          return;
        }

        localStorage.setItem("last_login", Date.now().toString());
        localStorage.setItem("user_phone", fullPhone);
        localStorage.setItem("is_signin", "true");
        
        // Track successful signin
        trackCustom('auth_signin_success', {
          method: 'phone',
          country_code: countryCode,
        }, 'user_action:signin', '/auth/signin');

        // Mixpanel: Identify user and track signin
        if (signInData.user) {
          identifyUser(signInData.user);
          trackEvent('auth_signin_success', {
            method: 'phone',
            country_code: countryCode,
          });
        }

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      setError(emailValidation.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      toast({
        title: "Reset link sent! 📧",
        description: "Check your email for password reset instructions",
      });

      setIsForgotPassword(false);
      setEmail("");
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError("Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#FDE8E4] via-[#FDF0ED] to-[#FDF5F3] p-6 pb-safe">
      {/* Logo */}
      <div className="text-center pt-8 pb-4">
        <img src={logo} alt="MyMirro" className="h-10 mx-auto" />
      </div>

      {/* AI Blob Illustration with Chat Bubbles */}
      <div className="relative flex items-center justify-center mb-4 mt-2">
        {/* Blob Image */}
        <motion.img 
          src={aiBlob} 
          alt="" 
          className="w-48 h-48 object-contain"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        
        {/* Right Chat Bubble */}
        <motion.div 
          className="absolute right-4 top-4 bg-white rounded-xl px-3 py-2 shadow-sm max-w-[160px]"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <p className="text-[11px] text-[#1a1a1a] leading-tight font-medium">
            Hi, I'm MyMirro<br />your personal AI stylist.
          </p>
          {/* Speech bubble tail */}
          <div className="absolute -left-2 bottom-3 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-white border-b-[6px] border-b-transparent" />
        </motion.div>
        
        {/* Left Chat Bubble */}
        <motion.div 
          className="absolute left-0 bottom-4 bg-white rounded-xl px-3 py-2 shadow-sm max-w-[180px]"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <p className="text-[11px] text-[#1a1a1a] leading-tight font-medium">
            I can help you plan outfits, shop smarter, and level up your style using your own closet.
          </p>
          {/* Speech bubble tail */}
          <div className="absolute -right-2 bottom-3 w-0 h-0 border-t-[6px] border-t-transparent border-l-[8px] border-l-white border-b-[6px] border-b-transparent" />
        </motion.div>
      </div>

      {/* Main Headline */}
      <motion.div 
        className="text-center mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <h1 className="text-[#1a1a1a] text-[20px] font-normal leading-tight font-boston">
          Your stylist is waiting.
        </h1>
        <h1 className="text-[#1a1a1a] text-[20px] font-normal leading-tight font-boston">
          Shall we begin?
        </h1>
      </motion.div>

      {/* Form Section */}
      <div className="flex-1 flex flex-col justify-end max-w-md mx-auto w-full">
        <form onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit} className="space-y-3">
          {/* Email Input */}
          {(isSignUp || isForgotPassword) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className="w-full h-14 bg-[#FDDDD6] border-0 rounded-2xl text-[#1a1a1a] placeholder:text-[#9B8A8A] text-base px-5 font-medium"
                disabled={loading}
              />
            </motion.div>
          )}

          {/* Phone Number Input */}
          {!isForgotPassword && (
            <motion.div 
              className="flex gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="w-[72px] h-14 bg-[#FDDDD6] border-0 rounded-2xl text-[#1a1a1a] text-base font-medium">
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
                className="flex-1 h-14 bg-[#FDDDD6] border-0 rounded-2xl text-[#1a1a1a] placeholder:text-[#9B8A8A] text-base px-5 font-medium"
                disabled={loading}
              />
            </motion.div>
          )}

          {/* Password Input */}
          {!isForgotPassword && (
            <motion.div 
              className="relative"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="w-full h-14 bg-[#FDDDD6] border-0 rounded-2xl text-[#1a1a1a] placeholder:text-[#9B8A8A] pr-12 text-base px-5 font-medium"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9B8A8A]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </motion.div>
          )}

          {!isSignUp && !isForgotPassword && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-[#6B5A5A] text-sm font-medium hover:underline"
              >
                Forgot your password?
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          {/* Sign Up Button */}
          <motion.div 
            className="flex justify-center pt-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <Button
              type="submit"
              className="w-40 h-12 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white text-base font-semibold rounded-full"
              disabled={loading}
            >
              {loading ? "Processing..." : isForgotPassword ? "Send Reset Link" : isSignUp ? "Sign up" : "Log in"}
            </Button>
          </motion.div>
        </form>

        {/* Already have an account / Back to login */}
        <motion.button
          onClick={() => {
            if (isForgotPassword) {
              setIsForgotPassword(false);
              setError("");
            } else {
              onBack();
            }
          }}
          className="w-full text-[#4A4A4A] text-base font-medium text-center py-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {isForgotPassword ? "Back to login" : isSignUp ? "Already have an account" : "Create new account"}
        </motion.button>
      </div>
    </div>
  );
};

export default PhoneAuth;
