import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalytics } from "@/hooks/useAnalytics";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [engagementTime, setEngagementTime] = useState(0);
  const { trackCustom } = useAnalytics();

  // Detect if user is on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    // Don't show if already installed
    if (isInStandaloneMode) return;

    // Track engagement time
    const startTime = Date.now();
    const interval = setInterval(() => {
      setEngagementTime(Date.now() - startTime);
    }, 1000);

    // Show prompt after 30 seconds of engagement
    const timer = setTimeout(() => {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      const dismissedTime = dismissed ? parseInt(dismissed) : 0;
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

      // Show again after 7 days
      if (!dismissed || daysSinceDismissed > 7) {
        if (isIOS) {
          setShowIOSInstructions(true);
        }
        setShowPrompt(true);
        trackCustom('pwa_install_prompt_shown', { platform: isIOS ? 'ios' : 'android' });
      }
    }, 30000); // 30 seconds

    // Listen for the beforeinstallprompt event (Chrome/Edge/Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isIOS, isInStandaloneMode, trackCustom]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    trackCustom('pwa_install_clicked', { engagement_time_seconds: engagementTime / 1000 });

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    trackCustom('pwa_install_outcome', { outcome, engagement_time_seconds: engagementTime / 1000 });

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
    setShowIOSInstructions(false);
    trackCustom('pwa_install_dismissed', { 
      platform: isIOS ? 'ios' : 'android',
      engagement_time_seconds: engagementTime / 1000 
    });
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96"
      >
        <div className="bg-card border border-border rounded-lg shadow-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <img src="/pwa-192x192.png" alt="MyMirro" className="w-12 h-12 rounded-lg" />
              <div>
                <h3 className="font-semibold text-foreground">Install MyMirro</h3>
                <p className="text-sm text-muted-foreground">
                  {isIOS ? 'Add to your home screen' : 'Install our app for faster access'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-8 w-8 -mt-1 -mr-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {showIOSInstructions ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How to install:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>
                  Tap the <Share className="inline h-4 w-4 mx-1" /> Share button at the bottom
                </li>
                <li>Scroll down and tap "Add to Home Screen"</li>
                <li>Tap "Add" in the top right corner</li>
              </ol>
            </div>
          ) : (
            deferredPrompt && (
              <Button
                onClick={handleInstallClick}
                className="w-full"
                size="lg"
              >
                <Download className="mr-2 h-4 w-4" />
                Install App
              </Button>
            )
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};