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
            initial={{ opacity: 0, scale: 0.8, x: -50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className="absolute left-4 top-12 bg-primary/20 backdrop-blur-sm rounded-2xl p-4 max-w-[70%]"
          >
            <p className="text-sm">What should I wear for a brunch date?</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
            className="absolute right-4 bottom-12 bg-secondary/20 backdrop-blur-sm rounded-2xl p-4 max-w-[70%]"
          >
            <div className="flex gap-2 mb-2">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0, y: [0, -8, 0] }}
                transition={{ 
                  scale: { delay: 0.8, type: "spring" },
                  rotate: { delay: 0.8, type: "spring" },
                  y: { repeat: Infinity, duration: 1.8, delay: 1.2 }
                }}
                className="w-12 h-16 bg-primary/30 rounded-lg"
              />
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0, y: [0, -8, 0] }}
                transition={{ 
                  scale: { delay: 1, type: "spring" },
                  rotate: { delay: 1, type: "spring" },
                  y: { repeat: Infinity, duration: 1.8, delay: 1.4 }
                }}
                className="w-12 h-16 bg-primary/30 rounded-lg"
              />
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0, y: [0, -8, 0] }}
                transition={{ 
                  scale: { delay: 1.2, type: "spring" },
                  rotate: { delay: 1.2, type: "spring" },
                  y: { repeat: Infinity, duration: 1.8, delay: 1.6 }
                }}
                className="w-12 h-16 bg-primary/30 rounded-lg"
              />
            </div>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="text-xs"
            >
              Here are some perfect options!
            </motion.p>
          </motion.div>

          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                y: [-10, 0, -10],
                x: [0, i === 1 ? 10 : -10, 0],
                rotate: [0, i * 120, 0]
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 2 + i * 0.3,
                delay: i * 0.2
              }}
              className="absolute"
              style={{
                top: `${20 + i * 10}%`,
                right: `${10 + i * 15}%`
              }}
            >
              <Sparkles className="w-5 h-5 text-primary" />
            </motion.div>
          ))}
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
            transition={{ delay: 0.3, type: "spring" }}
            className="grid grid-cols-4 gap-2 max-w-sm"
          >
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20, rotateY: -90 }}
                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                transition={{ 
                  delay: 0.5 + i * 0.08,
                  type: "spring",
                  stiffness: 200
                }}
                className="aspect-square bg-primary/20 backdrop-blur-sm rounded-lg flex items-center justify-center"
              >
                {i === 2 || i === 5 ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 1.2 + (i === 5 ? 0.3 : 0), type: "spring" }}
                  >
                    <motion.div
                      animate={{ 
                        scale: [1, 1.15, 1],
                        y: [0, -3, 0]
                      }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 2,
                        delay: i === 5 ? 0.3 : 0
                      }}
                      className="w-8 h-10 bg-primary/40 rounded relative overflow-hidden"
                    >
                      <motion.div
                        animate={{ y: ["100%", "-100%"] }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 1.5,
                          ease: "linear",
                          delay: 1.5
                        }}
                        className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent"
                      />
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 + i * 0.08 }}
                    className="text-xs text-muted-foreground"
                  >
                    {i + 1}
                  </motion.span>
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
            initial={{ opacity: 0, scale: 0.9, rotateY: -15 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 150 }}
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
                    initial={{ scale: 0, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ 
                      delay: 1.5 + i * 0.1,
                      type: "spring",
                      stiffness: 300
                    }}
                    className="flex-1 h-2 bg-primary/60 rounded-full relative overflow-hidden"
                  >
                    <motion.div
                      animate={{ x: ["0%", "100%"] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1,
                        delay: 1.7 + i * 0.1,
                        ease: "linear"
                      }}
                      className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                    />
                  </motion.div>
                ))}
              </div>
              <motion.p
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 2, type: "spring" }}
                className="text-xs text-foreground"
              >
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ 
                    repeat: Infinity,
                    duration: 1.5,
                    delay: 2.5
                  }}
                  className="inline-block"
                >
                  💜
                </motion.span>
                {" "}Love the color balance!
              </motion.p>
            </motion.div>
          </motion.div>
          
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
                x: [0, (i - 2) * 30],
                y: [0, -40]
              }}
              transition={{
                duration: 1.5,
                delay: 2 + i * 0.15,
                ease: "easeOut"
              }}
              className="absolute"
              style={{
                left: "50%",
                top: "50%"
              }}
            >
              <span className="text-2xl">✨</span>
            </motion.div>
          ))}
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

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={handleNext}
                className="w-full glow-primary text-lg h-12 relative overflow-hidden"
              >
                <motion.span
                  animate={currentSlide === slides.length - 1 ? {
                    scale: [1, 1.1, 1]
                  } : {}}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    delay: 1
                  }}
                >
                  {currentSlide === slides.length - 1 ? "Start Styling ✨" : "Next →"}
                </motion.span>
                {currentSlide === slides.length - 1 && (
                  <motion.div
                    animate={{ 
                      x: ["0%", "100%"]
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: "linear"
                    }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  />
                )}
              </Button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FeatureWalkthrough;
