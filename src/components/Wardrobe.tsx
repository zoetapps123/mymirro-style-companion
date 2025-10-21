import { Plus, Shirt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockGarments = [
  { id: "1", name: "White Oxford Shirt", category: "Tops", color: "#FFFFFF", image: "👕" },
  { id: "2", name: "Dark Denim Jeans", category: "Bottoms", color: "#1E3A8A", image: "👖" },
  { id: "3", name: "Black Leather Jacket", category: "Layers", color: "#000000", image: "🧥" },
  { id: "4", name: "Floral Summer Dress", category: "Dresses", color: "#FCA5A5", image: "👗" },
  { id: "5", name: "White Sneakers", category: "Shoes", color: "#FFFFFF", image: "👟" },
  { id: "6", name: "Silver Watch", category: "Accessories", color: "#C0C0C0", image: "⌚" },
];

const Wardrobe = () => {
  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Your Wardrobe</h2>
        <p className="text-sm text-muted-foreground">
          Your closet, upgraded. Shoot your clothes—watch MyMirro catalog them cleanly.
        </p>
      </div>

      {/* Search & Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search your wardrobe..."
            className="pl-10 glass-card border-border/50"
          />
        </div>
        <Button className="glow-primary">
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs defaultValue="all" className="flex-1 flex flex-col">
        <TabsList className="glass-card border-border/50">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="tops">Tops</TabsTrigger>
          <TabsTrigger value="bottoms">Bottoms</TabsTrigger>
          <TabsTrigger value="layers">Layers</TabsTrigger>
          <TabsTrigger value="dresses">Dresses</TabsTrigger>
          <TabsTrigger value="shoes">Shoes</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="flex-1 mt-4">
          <div className="grid grid-cols-2 gap-4">
            {mockGarments.map((garment) => (
              <div
                key={garment.id}
                className="glass-card p-4 rounded-2xl space-y-3 hover:glow-accent transition-all cursor-pointer"
              >
                <div className="aspect-square bg-muted/20 rounded-xl flex items-center justify-center text-6xl">
                  {garment.image}
                </div>
                <div>
                  <h3 className="font-medium text-sm">{garment.name}</h3>
                  <p className="text-xs text-muted-foreground">{garment.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-border"
                    style={{ backgroundColor: garment.color }}
                  />
                  <span className="text-xs text-muted-foreground">Primary</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="tops" className="flex-1 mt-4">
          <div className="text-center text-muted-foreground py-12">
            Filter by Tops
          </div>
        </TabsContent>
      </Tabs>

      {/* Outfit Builder CTA */}
      <Button variant="outline" className="glass-card border-border/50 w-full">
        <Shirt className="w-4 h-4 mr-2" />
        Build an Outfit
      </Button>
    </div>
  );
};

export default Wardrobe;
