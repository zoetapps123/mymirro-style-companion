import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import logo from "@/assets/logo.svg";
import slideChat from "@/assets/slide-chat.png";
import slideWardrobe from "@/assets/slide-wardrobe.png";
import slideStylecheck from "@/assets/slide-stylecheck.png";

interface WelcomeLandingProps {
  onSignUp: () => void;
  onLogIn: () => void;
}

const WelcomeLanding = ({ onSignUp, onLogIn }: WelcomeLandingProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Ask your stylist anything",
      image: slideChat
    },
    {
      title: "Create looks from your wardrobe",
      image: slideWardrobe
    },
    {
      title: "Improve your style using Style Check",
      image: slideStylecheck
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [slides.length]);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    } else {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-200 via-purple-300 to-pink-200 p-6">
      {/* Logo */}
      <div className="text-center pt-4 pb-4">
        <img src={logo} alt="MyMirro" className="h-16 mx-auto" style={{ filter: 'brightness(0) invert(1) drop-shadow(0 2px 8px rgba(0,0,0,0.2))' }} />
      </div>

      {/* Carousel */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 max-w-md mx-auto w-full">
        <div className="relative w-full h-80 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full flex items-center justify-center"
            >
              <div className="bg-white/20 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-white/30 w-full h-full">
                <div className="aspect-[9/16] h-full rounded-2xl bg-white/50 flex items-center justify-center overflow-hidden">
                  <img 
                    src={slides[currentSlide].image} 
                    alt={slides[currentSlide].title} 
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Swipe Buttons */}
          <button 
            onClick={() => handleSwipe('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/30 backdrop-blur-sm p-2 rounded-full hover:bg-white/50 transition-all"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button 
            onClick={() => handleSwipe('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/30 backdrop-blur-sm p-2 rounded-full hover:bg-white/50 transition-all"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Slide Indicators */}
        <div className="flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide 
                  ? 'w-12 bg-white' 
                  : 'w-2 bg-white/50'
              }`}
            />
          ))}
        </div>

        {/* Title */}
        <motion.p 
          key={`title-${currentSlide}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-white text-xl font-semibold text-center px-4"
        >
          {slides[currentSlide].title}
        </motion.p>
      </div>

      {/* CTAs */}
      <div className="space-y-4 pb-8 max-w-md mx-auto w-full">
        <Button
          onClick={onSignUp}
          className="w-full h-14 bg-black hover:bg-black/90 text-white text-lg font-semibold rounded-2xl"
        >
          Sign Up
        </Button>
        <button
          onClick={onLogIn}
          className="w-full text-black text-lg font-semibold"
        >
          Log In
        </button>
      </div>
    </div>
  );
};

export default WelcomeLanding;
