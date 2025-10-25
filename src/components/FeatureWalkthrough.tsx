import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, Calendar, Sparkles } from "lucide-react";

interface FeatureWalkthroughProps {
  onComplete: () => void;
}

const FeatureWalkthrough = ({ onComplete }: FeatureWalkthroughProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: "ask-stylist",
      title: "Ask Your Stylist Anything",
      description: "Your AI stylist can help you answer any fashion query — instantly.",
      icon: MessageCircle,
      animation: (
        <div className="relative w-full h-64 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute left-4 top-12 bg-primary/20 backdrop-blur-sm rounded-2xl p-4 max-w-[70%]"
          >
            <p className="text-sm">What should I wear for a brunch date?</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="absolute right-4 bottom-12 bg-secondary/20 backdrop-blur-sm rounded-2xl p-4 max-w-[70%]"
          >
            <div className="flex gap-2 mb-2">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, delay: 0 }}
                className="w-12 h-16 bg-primary/30 rounded-lg"
              />
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                className="w-12 h-16 bg-primary/30 rounded-lg"
              />
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}
                className="w-12 h-16 bg-primary/30 rounded-lg"
              />
            </div>
            <p className="text-xs">Here are some perfect options!</p>
          </motion.div>

          <motion.div
            animate={{ y: [-10, 0, -10] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute top-4 right-8"
          >
            <Sparkles className="w-6 h-6 text-primary" />
          </motion.div>
        </div>
      ),
    },
    {
      id: "plan-outfits",
      title: "Plan My Outfits",
      description: "Create and schedule looks — from daily fits to special occasions.",
      icon: Calendar,
      animation: (
        <div className="relative w-full h-64 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-4 gap-2 max-w-sm"
          >
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="aspect-square bg-primary/20 backdrop-blur-sm rounded-lg flex items-center justify-center"
              >
                {i === 2 || i === 5 ? (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-8 h-10 bg-primary/40 rounded"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">{i + 1}</span>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      ),
    },
    {
      id: "style-check",
      title: "Style Check",
      description: "Upload your outfit and get instant AI feedback to look your best.",
      icon: Sparkles,
      animation: (
        <div className="relative w-full h-64 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="relative w-48 h-56 bg-primary/10 backdrop-blur-sm rounded-2xl overflow-hidden"
          >
            <motion.div
              animate={{ y: ["0%", "100%"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="absolute inset-0 scanning-line opacity-50"
            />
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="absolute bottom-4 left-4 right-4 space-y-2"
            >
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.5 + i * 0.1 }}
                    className="flex-1 h-2 bg-primary/60 rounded-full"
                  />
                ))}
              </div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2 }}
                className="text-xs text-foreground"
              >
                Love the color balance! 💜
              </motion.p>
            </motion.div>
          </motion.div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      localStorage.setItem("isFirstLogin", "false");
      localStorage.setItem("walkthroughComplete", "true");
      onComplete();
    }
  };

  const currentSlideData = slides[currentSlide];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="glass-card rounded-2xl p-8 space-y-8"
          >
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center glow-primary">
                <currentSlideData.icon className="w-8 h-8 text-primary" />
              </div>
            </div>

            {currentSlideData.animation}

            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold text-gradient-primary">
                {currentSlideData.title}
              </h2>
              <p className="text-muted-foreground">
                {currentSlideData.description}
              </p>
            </div>

            {/* Progress Dots */}
            <div className="flex justify-center gap-2">
              {slides.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? "w-8 bg-primary"
                      : "w-2 bg-primary/30"
                  }`}
                />
              ))}
            </div>

            <Button
              onClick={handleNext}
              className="w-full glow-primary text-lg h-12"
            >
              {currentSlide === slides.length - 1 ? "Start Styling →" : "Next →"}
            </Button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FeatureWalkthrough;
