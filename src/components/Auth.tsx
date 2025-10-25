import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [otpTimer, setOtpTimer] = useState(300); // 5 minutes in seconds
  const [error, setError] = useState("");
  const [sendAttempts, setSendAttempts] = useState(0);
  const [verified, setVerified] = useState(false);
  const { toast } = useToast();
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Mask email for display (p***@y***.in)
  const maskEmail = (email: string) => {
    const [username, domain] = email.split("@");
    if (!username || !domain) return email;
    const maskedUsername = username[0] + "***";
    const [domainName, ext] = domain.split(".");
    const maskedDomain = domainName[0] + "***." + ext;
    return `${maskedUsername}@${maskedDomain}`;
  };

  // Format timer as MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Analytics helper
  const trackEvent = (eventName: string, metadata?: any) => {
    console.log(`[Analytics] ${eventName}`, metadata);
    // Integrate with your analytics service here
  };

  // OTP expiry countdown (5 minutes)
  useEffect(() => {
    if (!otpSent) return;

    const interval = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setError("Code expired. Please resend a new one.");
          trackEvent("auth_otp_expired", { email });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [otpSent, email]);

  // Resend cooldown (30 seconds)
  useEffect(() => {
    if (!otpSent || canResend) return;

    const interval = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [otpSent, canResend]);

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Rate limiting check (client-side)
    if (sendAttempts >= 5) {
      setError("Too many attempts. Please try again later.");
      toast({
        title: "Rate Limit Reached",
        description: "Too many attempts. Please try again in an hour.",
        variant: "destructive",
      });
      trackEvent("auth_otp_rate_limited", { email });
      return;
    }

    setLoading(true);
    setError("");
    trackEvent("auth_otp_send_clicked", { email });

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      setOtpSent(true);
      setCanResend(false);
      setResendCountdown(30);
      setOtpTimer(300); // Reset to 5 minutes
      setSendAttempts((prev) => prev + 1);
      setOtp(["", "", "", "", "", ""]); // Clear OTP inputs
      
      // Focus first OTP input
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);

      // QA: success instrumentation
      console.log("OTP send success", { email: maskEmail(email) });
      trackEvent("auth_code_viewed", { email: maskEmail(email) });

      toast({
        title: "Code Sent!",
        description: `We've sent a 6-digit code to ${maskEmail(email)}.`,
      });

      trackEvent("auth_otp_sent", { email: maskEmail(email) });
    } catch (error: any) {
      setError(error.message);
      console.error("OTP send error", error?.message || error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      trackEvent("auth_otp_send_error", { email: maskEmail(email), error: error.message });
      trackEvent("auth_otp_send_failed", { email: maskEmail(email), error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    // Auto-advance to next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (index === 5 && value && newOtp.every((digit) => digit !== "")) {
      handleVerifyOTP(newOtp.join(""));
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }

    // Handle paste
    if (e.key === "v" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 6).split("");
        const newOtp = [...otp];
        digits.forEach((digit, i) => {
          if (i < 6) newOtp[i] = digit;
        });
        setOtp(newOtp);
        
        // Focus last filled input or verify if all filled
        const lastFilledIndex = Math.min(digits.length - 1, 5);
        otpInputRefs.current[lastFilledIndex]?.focus();
        
        if (digits.length === 6) {
          trackEvent("auth_code_paste_used", { email: maskEmail(email) });
          handleVerifyOTP(newOtp.join(""));
        }
      });
    }
  };

  const handleVerifyOTP = async (code?: string) => {
    const otpCode = code || otp.join("");
    
    if (otpCode.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }

    if (otpTimer <= 0) {
      setError("Code expired. Please resend a new one.");
      return;
    }

    setLoading(true);
    setError("");
    trackEvent("auth_code_verify_clicked", { email: maskEmail(email) });

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });

      if (error) {
        if (error.message.includes("expired")) {
          setError("Code expired. Please resend a new one.");
          trackEvent("auth_otp_expired", { email: maskEmail(email) });
        } else if (error.message.includes("invalid") || error.message.includes("not match")) {
          setError("That code doesn't match. Try again.");
          trackEvent("auth_otp_invalid_attempt", { email: maskEmail(email) });
          // Clear OTP inputs for retry
          setOtp(["", "", "", "", "", ""]);
          otpInputRefs.current[0]?.focus();
        } else {
          setError(error.message);
        }
        throw error;
      }

      // Success animation
      setVerified(true);
      console.log("OTP verify success");
      trackEvent("auth_otp_verified", { email: maskEmail(email) });
      trackEvent("auth_login_success", { email: maskEmail(email) });
      // Set remember me if checked
      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("rememberMeExpiry", (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
        trackEvent("auth_remember7d_enabled", { email: maskEmail(email) });
      }

      toast({
        title: "You're in. Welcome back!",
        description: "Redirecting to your dashboard...",
      });

      // Redirect will happen automatically via Index.tsx auth state change
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setOtpSent(false);
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setCanResend(false);
    setResendCountdown(30);
    setOtpTimer(300);
    trackEvent("auth_back_to_email", { email: maskEmail(email) });
  };

  const handleResend = () => {
    if (!canResend || loading) return;
    trackEvent("auth_resend_clicked", { email: maskEmail(email) });
    handleSendOTP();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {!otpSent ? (
            // Screen 1: Email Entry
            <motion.div
              key="email-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
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
                  <Sparkles className="w-10 h-10 text-primary" />
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
                  <h2 className="text-2xl font-bold">Sign in with Email</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your email to receive a verification code
                  </p>
                </div>

                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        trackEvent("auth_email_entered");
                      }}
                      required
                      disabled={loading}
                      className="glass-card border-border/50 h-12 text-base"
                      autoFocus
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full glow-primary h-12 text-base"
                    disabled={loading || !email}
                  >
                    {loading ? "Sending..." : "Send Code"}
                  </Button>
                </form>
              </motion.div>
            </motion.div>
          ) : (
            // Screen 2: OTP Entry
            <motion.div
              key="otp-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
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
                  {verified ? (
                    <CheckCircle2 className="w-10 h-10 text-primary animate-scale-in" />
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
                <button
                  onClick={handleBackToEmail}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to email
                </button>

                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold">Enter your 6-digit code</h2>
                  <p className="text-sm text-muted-foreground">
                    Sent to <span className="font-medium text-foreground">{maskEmail(email)}</span>
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span>Expires in {formatTimer(otpTimer)}</span>
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleVerifyOTP(); }} className="space-y-6">
                  {/* Custom OTP Input Boxes */}
                  <div className="flex justify-center gap-2">
                    {otp.map((digit, index) => (
                      <motion.input
                        key={index}
                        ref={(el) => (otpInputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOTPChange(index, e.target.value)}
                        onKeyDown={(e) => handleOTPKeyDown(index, e)}
                        disabled={loading || verified}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl bg-background/50 backdrop-blur-sm border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    ))}
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-destructive text-center"
                      role="alert"
                      aria-live="polite"
                    >
                      {error}
                    </motion.p>
                  )}

                  <div className="flex items-center justify-center space-x-2">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-border w-4 h-4"
                      disabled={loading}
                    />
                    <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                      Keep me signed in for 7 days on this device
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full glow-primary h-12 text-base"
                    disabled={loading || otp.some((d) => !d) || verified}
                  >
                    {loading ? "Verifying..." : verified ? "Verified ✓" : "Verify"}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={!canResend || loading}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {canResend
                        ? "Didn't get it? Resend code"
                        : `Resend in ${resendCountdown.toString().padStart(2, "0")}s`}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Auth;
