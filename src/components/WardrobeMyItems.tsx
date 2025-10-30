import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WardrobeMyItemsProps {
  onBack: () => void;
}

const WardrobeMyItems = ({ onBack }: WardrobeMyItemsProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const { toast } = useToast();

  const categories = ["All", "Tops", "Bottoms", "Layers", "Dresses", "Shoes"];

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load wardrobe items.",
        variant: "destructive",
      });
      return;
    }

    setItems(data || []);
  };

  const filteredItems =
    selectedCategory === "All"
      ? items
      : items.filter((item) => item.category === selectedCategory);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Title */}
      <div className="p-4 pb-3">
        <h2 className="text-xl font-bold">My Items</h2>
      </div>

      {/* Category Filter */}
      <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full min-h-[36px] ${
                selectedCategory === category
                  ? "bg-black text-white hover:bg-black/90"
                  : "bg-transparent border-border text-foreground hover:bg-muted"
              }`}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="aspect-[3/4] rounded-2xl overflow-hidden border border-border/50 relative"
            >
              <img
                src={item.processed_image_url || item.image_url}
                alt={item.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white text-sm font-medium truncate">
                  {item.name}
                </p>
              </div>
            </div>
          ))}

          {/* Add Item Card */}
          <button
            onClick={onBack}
            className="aspect-[3/4] rounded-2xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-2 hover:border-primary transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center">
              <Plus className="w-8 h-8 text-white" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WardrobeMyItems;
