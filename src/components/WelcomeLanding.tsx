import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import welcomeDemo from "@/assets/welcome-demo.png";

interface WelcomeLandingProps {
  onSignUp: () => void;
  onLogIn: () => void;
}

const WelcomeLanding = ({ onSignUp, onLogIn }: WelcomeLandingProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Ask your stylist anything",
      image: welcomeDemo
    },
    {
      title: "Create looks from your wardrobe",
      description: "Mix and match items to discover new outfit combinations"
    },
    {
      title: "Improve your style using Style Check",
      description: "Get AI-powered feedback on your outfits"
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
      <div className="text-center pt-8 pb-12">
        <h1 className="text-5xl font-bold text-white tracking-wide" style={{ fontFamily: 'cursive' }}>
          MyMirro
        </h1>
      </div>

      {/* Carousel */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <div className="relative w-full max-w-md h-96 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full flex items-center justify-center"
            >
              <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/30 w-full">
                <div className="aspect-square rounded-2xl bg-white/50 flex items-center justify-center mb-4">
                  {currentSlide === 0 && slides[0].image ? (
                    <img 
                      src={slides[0].image} 
                      alt="Style preview" 
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    <div className="text-center p-6">
                      <p className="text-lg text-gray-700">{slides[currentSlide].description}</p>
                    </div>
                  )}
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
          className="text-white text-2xl font-semibold text-center px-4"
        >
          {slides[currentSlide].title}
        </motion.p>
      </div>

      {/* CTAs */}
      <div className="space-y-4 pb-8">
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
