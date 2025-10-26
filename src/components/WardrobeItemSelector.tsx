import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shirt } from "lucide-react";
import { motion } from "framer-motion";

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  image_url: string;
  processed_image_url: string;
  color: string;
}

interface WardrobeItemSelectorProps {
  onSelect: (item: WardrobeItem) => void;
  onBack: () => void;
}

const WardrobeItemSelector = ({ onSelect, onBack }: WardrobeItemSelectorProps) => {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('wardrobe_items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching wardrobe items:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gradient-primary">Select an Item</h2>
        <p className="text-sm text-muted-foreground">
          Pick an item from your wardrobe to start creating outfits
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">Loading your wardrobe...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center space-y-4">
            <Shirt className="w-16 h-16 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Your wardrobe is empty. Add items first!</p>
            <Button onClick={onBack}>Go Back</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 overflow-auto">
          {items.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="glass-card p-3 rounded-xl cursor-pointer space-y-2"
              onClick={() => onSelect(item)}
            >
              <div className="aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden">
                {item.processed_image_url ? (
                  <img
                    src={item.processed_image_url}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Shirt className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WardrobeItemSelector;
