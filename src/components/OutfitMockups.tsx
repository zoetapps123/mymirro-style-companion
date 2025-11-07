import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { orderOutfitForDisplay } from "@/lib/utils";

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  processed_image_url?: string;
  image_url: string;
}

interface OutfitMockupsProps {
  items: WardrobeItem[];
}

export const OutfitMockups = ({ items }: OutfitMockupsProps) => {
  // Create 2-3 example mockup outfits
  const createMockOutfit = (outfitItems: WardrobeItem[]) => {
    // Organize by category: upper, lower, footwear, layer
    const upper = outfitItems.find(i => 
      ['shirt', 'top', 'blouse', 'tshirt', 't-shirt', 'upperwear'].some(cat => 
        i.category?.toLowerCase().includes(cat)
      )
    );
    const lower = outfitItems.find(i => 
      ['pants', 'jeans', 'trousers', 'skirt', 'shorts', 'lowerwear'].some(cat => 
        i.category?.toLowerCase().includes(cat)
      )
    );
    const footwear = outfitItems.find(i => 
      ['shoes', 'sneakers', 'boots', 'sandals', 'heels', 'footwear'].some(cat => 
        i.category?.toLowerCase().includes(cat)
      )
    );
    
    return [upper, lower, footwear].filter(Boolean) as WardrobeItem[];
  };

  // Generate up to 3 different outfit combinations
  const mockOutfits = [];
  
  if (items.length >= 3) {
    // First outfit
    mockOutfits.push(createMockOutfit(items.slice(0, 6)));
    
    // Second outfit if we have enough items
    if (items.length >= 6) {
      mockOutfits.push(createMockOutfit(items.slice(3, 9)));
    }
    
    // Third outfit if we have enough items
    if (items.length >= 9) {
      mockOutfits.push(createMockOutfit(items.slice(6, 12)));
    }
  }

  if (mockOutfits.length === 0) {
    return null; // Not enough items to show mockups
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {mockOutfits.map((outfit, outfitIdx) => (
          <motion.div
            key={outfitIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: outfitIdx * 0.15 }}
          >
            <Card className="flex-shrink-0 w-48 p-3 bg-white shadow-md hover:shadow-lg transition-shadow">
              <div className="grid grid-cols-2 gap-2">
                {orderOutfitForDisplay(outfit).map((item, itemIdx) => (
                  <div 
                    key={item.id} 
                    className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center p-1 transform hover:scale-105 transition-transform"
                    style={{ 
                      transform: `rotate(${itemIdx % 2 === 0 ? -2 : 2}deg)`,
                    }}
                  >
                    <img
                      src={item.processed_image_url || item.image_url}
                      alt={item.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
