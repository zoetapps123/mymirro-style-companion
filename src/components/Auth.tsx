import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface AuthProps {
  onEmailCaptured: (email: string) => void;
}

const Auth = ({ onEmailCaptured }: AuthProps) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const { toast } = useToast();

  // Analytics helper
  const trackEvent = (eventName: string, metadata?: any) => {
    console.log(`[Analytics] ${eventName}`, metadata);
  };

  // RFC5322 basic email validation
  const isValidEmail = (email: string) => {
    return /^\S+@\S+\.\S+$/.test(email);
  };

  // Mask email for analytics (p***@y***.in)
  const maskEmail = (email: string) => {
    const [username, domain] = email.split("@");
    if (!username || !domain) return email;
    const maskedUsername = username[0] + "***";
    const [domainName, ext] = domain.split(".");
    const maskedDomain = domainName[0] + "***." + ext;
    return `${maskedUsername}@${maskedDomain}`;
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      trackEvent("onboard_email_invalid");
      return;
    }

    setLoading(true);
    setCheckingEmail(true);
    setError("");
    trackEvent("onboard_email_submit_clicked", { email: maskEmail(email) });

    try {
      // Check if returning user (email exists in localStorage)
      const storedEmail = localStorage.getItem("onboard_email");
      const isReturning = storedEmail === email;
      
      if (isReturning) {
        // Check if session is still valid (7 days)
        const lastLogin = localStorage.getItem("last_login");
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        if (lastLogin && parseInt(lastLogin) > sevenDaysAgo) {
          trackEvent("returning_user_auto_signin", { email: maskEmail(email) });
          toast({
            title: `Welcome back! 👋`,
            description: "We missed your fits.",
          });
          setSuccess(true);
          setTimeout(() => {
            onEmailCaptured(email);
          }, 800);
          return;
        }
      }
      
      // Store email and login timestamp
      localStorage.setItem("onboard_email", email);
      localStorage.setItem("last_login", Date.now().toString());
      
      // Fire-and-forget API call (optional backend endpoint)
      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "onboarding_email_step",
          device: "web-mobile",
          returning: isReturning
        }),
      }).catch(() => {
        console.log("API call failed, saved locally");
      });

      if (isReturning) {
        trackEvent("returning_user_proceed", { email: maskEmail(email) });
      } else {
        trackEvent("new_user_proceed", { email: maskEmail(email) });
      }
      
      // Success animation
      setSuccess(true);
      
      setTimeout(() => {
        trackEvent("onboard_advance_to_profile_details");
        onEmailCaptured(email);
      }, 800);
    } catch (error: any) {
      setError(error.message || "Something went wrong. Please try again.");
      trackEvent("onboard_email_saved_error", { error: error.message });
      toast({
        title: "Saved locally",
        description: "We'll sync when you're online.",
      });
    } finally {
      setTimeout(() => {
        setLoading(false);
        setCheckingEmail(false);
      }, 800);
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
              ) : checkingEmail ? (
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
              <h2 className="text-2xl font-bold">Start your fashion journey</h2>
              <p className="text-sm text-muted-foreground">
                We'll personalize your experience and share important updates
              </p>
            </div>

            <form onSubmit={handleContinue} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Your Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                    trackEvent("onboard_email_typed");
                  }}
                  onFocus={() => trackEvent("onboard_email_viewed")}
                  required
                  disabled={loading || success}
                  className="glass-card border-border/50 h-12 text-base"
                  autoFocus
                  aria-invalid={!!error}
                  aria-describedby={error ? "email-error" : undefined}
                />
                {error && (
                  <motion.p
                    id="email-error"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-destructive"
                    role="alert"
                    aria-live="polite"
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full glow-primary h-12 text-base"
                disabled={loading || !email || success}
              >
                {loading ? "Continuing..." : success ? "Success ✓" : "Continue"}
              </Button>
            </form>

            <div className="text-center">
              <a
                href="/privacy"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Privacy
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
