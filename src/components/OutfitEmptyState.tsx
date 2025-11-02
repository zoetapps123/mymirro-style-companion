import { motion } from "framer-motion";
import { Sparkles, Shirt } from "lucide-react";
import { Button } from "./ui/button";

interface OutfitEmptyStateProps {
  onGenerate: () => void;
}

const OutfitEmptyState = ({ onGenerate }: OutfitEmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative mb-6"
      >
        <div className="relative">
          <Shirt className="w-24 h-24 text-primary/30" />
          <motion.div
            className="absolute -top-2 -right-2"
            animate={{
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Sparkles className="w-8 h-8 text-primary" />
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3 max-w-sm"
      >
        <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Your wardrobe's waiting for its moment 💁‍♀️
        </h3>
        <p className="text-muted-foreground text-sm">
          Let MyMirro work its magic and create stunning outfits from your closet
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8"
      >
        <Button
          onClick={onGenerate}
          className="glow-primary group"
          size="lg"
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          >
            <Sparkles className="w-5 h-5 mr-2" />
          </motion.div>
          Generate Outfits
        </Button>
      </motion.div>
    </div>
  );
};

export default OutfitEmptyState;
