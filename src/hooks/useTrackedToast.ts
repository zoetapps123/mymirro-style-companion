import { useToast, toast as originalToast } from "@/hooks/use-toast";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useCallback } from "react";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  [key: string]: any;
}

/**
 * Enhanced toast hook that automatically tracks error toasts in analytics
 */
export const useTrackedToast = () => {
  const { toast: baseToast } = useToast();
  const { trackCustom } = useAnalytics();

  const trackedToast = useCallback((options: ToastOptions) => {
    // Track destructive/error toasts automatically
    if (options.variant === "destructive") {
      trackCustom('error_popup_shown', {
        error_message: options.description || options.title || 'Unknown error',
        error_title: options.title,
        error_type: 'toast_error'
      }, 'frustration:error_popup');
    }

    // Call original toast
    return baseToast(options);
  }, [baseToast, trackCustom]);

  return { toast: trackedToast };
};

// Also export a standalone tracked toast function
export const trackedToast = (options: ToastOptions) => {
  // This is a simplified version for direct usage
  // For full analytics, use the hook version
  return originalToast(options);
};
