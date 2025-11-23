import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, RefreshCw } from "lucide-react";

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
  isScanning = false,
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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl border-t border-border/50 max-h-[80vh] overflow-hidden"
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {prediction.comment}
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      💎 {prediction.occasion}
                    </Badge>
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      🎨 {prediction.style}
                    </Badge>
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      🌈 {prediction.vibe}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {onRetry && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onRetry}
                      disabled={isScanning}
                      className="hover:scale-110 transition-transform"
                      title="Retry prediction"
                    >
                      <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={onConfirm}
                  className="flex-1 h-12 text-base"
                  size="lg"
                >
                  Yes, Check My Style ✨
                </Button>
                <Button
                  onClick={onEdit}
                  variant="outline"
                  className="flex-1 h-12 text-base"
                  size="lg"
                >
                  Change Details
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};