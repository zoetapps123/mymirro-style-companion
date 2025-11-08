import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";
import slide1 from "@/assets/slide-1.png";
import slide2 from "@/assets/slide-2.png";
import slide3 from "@/assets/slide-3.png";

interface WelcomeLandingProps {
  onSignUp: () => void;
  onLogIn: () => void;
}

const WelcomeLanding = ({ onSignUp, onLogIn }: WelcomeLandingProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Get personalized style advice",
      image: slide1
    },
    {
      title: "Organize and style your wardrobe",
      image: slide2
    },
    {
      title: "Rate your outfits with AI",
      image: slide3
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
        <img src={logo} alt="MyMirro" className="h-16 mx-auto" />
      </div>

      {/* Carousel */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 max-w-md mx-auto w-full">
        <div className="relative w-full h-[500px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              className="w-full h-full flex items-center justify-center"
            >
              <img 
                src={slides[currentSlide].image} 
                alt={slides[currentSlide].title} 
                className="w-full h-full object-cover rounded-2xl"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Slide Indicators */}
        <div className="flex gap-2">
          {slides.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => setCurrentSlide(index)}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? 'w-12 bg-gradient-to-r from-purple-600 to-pink-600' 
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
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onSignUp}
            className="w-full h-14 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-semibold rounded-2xl shadow-xl"
          >
            Sign Up
          </Button>
        </motion.div>
        <motion.button
          onClick={onLogIn}
          whileHover={{ scale: 1.05 }}
          className="w-full text-white text-lg font-semibold hover:underline underline-offset-4 transition-all"
        >
          Log In
        </motion.button>
      </div>
    </div>
  );
};

export default WelcomeLanding;
