import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface AnalysisLoaderProps {
  isVisible: boolean;
  processingImage?: string;
  occasion?: string;
  message?: string;
}

const useCases = [
  "Plan outfits for every occasion ✨",
  "Validate your style instantly 👔",
  "Ask your AI stylist anything 💬",
  "Mix & match like a pro 🎨",
  "Shop smarter, not harder 🛍️",
];

const AnalysisLoader = ({ isVisible, processingImage, occasion, message }: AnalysisLoaderProps) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full space-y-4 sm:space-y-8">
            {/* Processing Image */}
            {processingImage && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative mx-auto w-48 h-56 sm:h-64"
              >
                <div className="absolute inset-0 rounded-3xl overflow-hidden border-4 border-primary/20 shadow-2xl">
                  <img
                    src={processingImage}
                    alt="Processing"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent" />
                </div>
                
                {/* Scanning animation */}
                <motion.div
                  className="absolute inset-0 rounded-3xl"
                  style={{
                    background: "linear-gradient(transparent, rgba(198, 108, 246, 0.3), transparent)",
                    height: "20%",
                  }}
                  animate={{
                    y: ["0%", "400%", "0%"],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                
                {/* Sparkle icon */}
                <motion.div
                  className="absolute -top-2 -right-2 bg-white rounded-full p-3 shadow-xl"
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity },
                  }}
                >
                  <Sparkles className="w-6 h-6 text-primary" />
                </motion.div>
              </motion.div>
            )}

            {/* Animated text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center space-y-6"
            >
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {message || "Analyzing Your Style"}
              </h2>
              {occasion && (
                <p className="text-base text-muted-foreground">
                  {occasion}
                </p>
              )}
              
              {/* Rotating use cases */}
              <div className="h-16 flex items-center justify-center">
                {useCases.map((useCase, index) => (
                  <motion.p
                    key={index}
                    className="text-lg text-gray-600 absolute"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      y: [20, 0, 0, -20],
                    }}
                    transition={{
                      duration: 4,
                      delay: index * 4,
                      repeat: Infinity,
                      repeatDelay: (useCases.length - 1) * 4,
                    }}
                  >
                    {useCase}
                  </motion.p>
                ))}
              </div>

              {/* Loading dots */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 rounded-full bg-primary"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnalysisLoader;
