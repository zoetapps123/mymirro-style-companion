import { motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";

interface OutfitGenerateConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemCount: number;
}

const OutfitGenerateConfirmation = ({
  isOpen,
  onClose,
  onConfirm,
  itemCount,
}: OutfitGenerateConfirmationProps) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background rounded-3xl p-6 max-w-md w-full space-y-6 relative border border-border shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-4 pt-4">
          <motion.div
            animate={{
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
            className="inline-block"
          >
            <Sparkles className="w-16 h-16 mx-auto text-primary" />
          </motion.div>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Generate Outfits?
            </h3>
            <p className="text-muted-foreground">
              MyMirro will create personalized outfit combinations from your{" "}
              <span className="font-semibold text-foreground">{itemCount} items</span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={onConfirm}
            className="w-full glow-primary"
            size="lg"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Let's Do It!
          </Button>
          <Button onClick={onClose} variant="ghost" className="w-full" size="lg">
            Maybe Later
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default OutfitGenerateConfirmation;
