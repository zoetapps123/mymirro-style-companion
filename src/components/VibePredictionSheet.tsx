import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface VibePredictionSheetProps {
  isOpen: boolean;
  prediction: {
    occasion: string;
    style: string;
    vibe: string;
    comment: string;
  } | null;
  onConfirm: () => void;
  onEdit: () => void;
  onClose: () => void;
  onRetry?: () => void;
  isScanning?: boolean;
}

export const VibePredictionSheet = ({
  isOpen,
  prediction,
  onConfirm,
  onEdit,
  onClose,
  onRetry,
  isScanning = false
}: VibePredictionSheetProps) => {
  if (!prediction) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-md z-[100]"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300
            }}
            className="fixed bottom-0 left-0 right-0 z-[101] bg-background rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto mx-auto sm:max-w-lg md:max-w-xl"
          >
            <div className="relative px-4 sm:px-6 pt-[30px] pb-8">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center hover:bg-muted/20 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Title */}
              <h2 className="font-boston font-bold text-[22px] leading-tight mb-3 text-foreground">
                Is this your vibe?
              </h2>

              {/* Subheading */}
              <p className="font-boston text-xs leading-relaxed mb-5 pr-8" style={{ color: '#4A4A4A' }}>
                We analysed your outfit and this is the vibe it's giving. Confirm so that we can nail the <span style={{ color: '#000000' }}>Style Check</span> perfectly
              </p>

              {/* Dotted Divider */}
              <div className="border-t-2 border-dashed border-border/60 mb-5" />

              {/* Dynamic Vibe Description */}
              <h3 className="font-boston font-bold text-[22px] leading-tight mb-3 bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
                {prediction.comment}
              </h3>

              {/* Pills Container */}
              <div className="flex flex-col gap-3 mb-[22px]">
                {/* First Row: Vibe + Style */}
                <div className="flex flex-wrap gap-3">
                  <div className="px-4 py-2.5 rounded-full bg-white border border-border/30 flex items-center gap-2">
                    <span className="text-base">🌀</span>
                    <span className="font-boston font-semibold text-xs text-foreground">
                      Vibe: {prediction.vibe}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 rounded-full bg-white border border-border/30 flex items-center gap-2">
                    <span className="text-base">👔</span>
                    <span className="font-boston font-semibold text-xs text-foreground">
                      Style: {prediction.style}
                    </span>
                  </div>
                </div>
                
                {/* Second Row: Occasion (left-aligned) */}
                <div className="px-4 py-2.5 rounded-full bg-white border border-border/30 flex items-center gap-2 w-fit">
                  <span className="text-base">📍</span>
                  <span className="font-boston font-semibold text-xs text-foreground">
                    Occasion: {prediction.occasion}
                  </span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex gap-2.5 sm:gap-3">
                <Button
                  onClick={onConfirm}
                  className="flex-1 h-11 sm:h-12 rounded-full font-boston font-bold text-xs sm:text-sm bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-sm px-3 sm:px-4"
                >
                  Yes, That's My Vibe!! ✨
                </Button>
                <Button
                  onClick={onEdit}
                  variant="outline"
                  className="flex-1 h-11 sm:h-12 rounded-full font-boston font-semibold text-xs sm:text-sm bg-white border-2 border-border/50 hover:bg-muted/10 px-3 sm:px-4"
                  style={{ color: '#454545' }}
                >
                  No, Change Details
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};