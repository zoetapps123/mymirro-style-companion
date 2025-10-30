import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
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

const PhoneAuth = ({ isSignUp, onBack, onSuccess }: PhoneAuthProps) => {
  const [loading, setLoading] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

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
      
      if (isSignUp) {
        // For now, use email-based signup with phone as identifier
        // In production, implement proper phone OTP authentication
        const email = `${phone}@mymirro.app`;
        const { error: signUpError } = await supabase.auth.signUp({
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
        const email = `${phone}@mymirro.app`;
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/50 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'cursive' }}>
            MyMirro
          </h1>
        </div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div>
            <h2 className="text-3xl font-bold mb-2 text-gray-900">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-gray-600">
              {isSignUp 
                ? "Start your fashion journey with MyMirro"
                : "Sign in to continue your style evolution"
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Phone Number</label>
              <div className="flex gap-2">
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-24 h-12 bg-white border-gray-200">
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
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    setError("");
                  }}
                  className="h-12 bg-white border-gray-200 text-gray-900"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  className="h-12 bg-white border-gray-200 text-gray-900 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-14 bg-black hover:bg-black/90 text-white text-lg font-semibold rounded-2xl mt-6"
              disabled={loading}
            >
              {loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default PhoneAuth;
