import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface AuthProps {
  onEmailCaptured: (email: string) => void;
}

const emailSchema = z.string().trim().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const Auth = ({ onEmailCaptured }: AuthProps) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true); // Default to signup for new users
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate inputs
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      setError(emailValidation.error.errors[0].message);
      return;
    }

    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      setError(passwordValidation.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up new user
        const { error: signUpError, data } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          }
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            setError("This email is already registered. Please sign in instead.");
            setIsSignUp(false);
          } else {
            setError(signUpError.message);
          }
          return;
        }

        // Store session timestamp
        localStorage.setItem("last_login", Date.now().toString());
        localStorage.setItem("onboard_email", email.trim());

        setSuccess(true);
        toast({
          title: "Welcome to MyMirro! 🎉",
          description: "Your fashion journey starts now",
        });

        setTimeout(() => {
          onEmailCaptured(email.trim());
        }, 800);

      } else {
        // Sign in existing user
        const { error: signInError, data } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          if (signInError.message.includes("Invalid login credentials")) {
            setError("Invalid email or password. Please try again.");
          } else {
            setError(signInError.message);
          }
          return;
        }

        // Check if within 7-day session
        const lastLogin = localStorage.getItem("last_login");
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const isReturning = lastLogin && parseInt(lastLogin) > sevenDaysAgo;

        // Update session timestamp
        localStorage.setItem("last_login", Date.now().toString());
        localStorage.setItem("onboard_email", email.trim());

        setSuccess(true);
        toast({
          title: isReturning ? "Welcome back! 👋" : "Signed in successfully!",
          description: isReturning ? "We missed your fits." : "Your fashion journey continues",
        });

        setTimeout(() => {
          onEmailCaptured(email.trim());
        }, 800);
      }

    } catch (err: any) {
      console.error('Auth error:', err);
      setError("Something went wrong. Please try again.");
      toast({
        title: "Error",
        description: "Failed to authenticate. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <div className="text-center space-y-2">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mx-auto w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center glow-primary"
            >
              {success ? (
                <CheckCircle2 className="w-10 h-10 text-primary animate-scale-in" />
              ) : loading ? (
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              ) : (
                <Sparkles className="w-10 h-10 text-primary" />
              )}
            </motion.div>
            <h1 className="text-4xl font-bold text-gradient-primary">MyMirro</h1>
            <p className="text-muted-foreground">Your AI Stylist Companion</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl p-8 space-y-6"
          >
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">
                {isSignUp ? "Create your account" : "Welcome back"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isSignUp 
                  ? "Start your fashion journey with MyMirro"
                  : "Sign in to continue your style evolution"
                }
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  required
                  disabled={loading || success}
                  className="glass-card border-border/50 h-12 text-base"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    required
                    disabled={loading || success}
                    className="glass-card border-border/50 h-12 text-base pr-10"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading || success}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {isSignUp && (
                  <p className="text-xs text-muted-foreground">
                    Must be at least 6 characters
                  </p>
                )}
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive text-center"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                className="w-full glow-primary h-12 text-base"
                disabled={loading || !email || !password || success}
              >
                {loading 
                  ? "Processing..." 
                  : success 
                  ? "Success ✓" 
                  : isSignUp 
                  ? "Create Account" 
                  : "Sign In"
                }
              </Button>
            </form>

            <div className="text-center space-y-2">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                }}
                disabled={loading || success}
                className="text-sm text-primary hover:underline transition-all disabled:opacity-50"
              >
                {isSignUp 
                  ? "Already have an account? Sign in" 
                  : "New here? Create an account"
                }
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
