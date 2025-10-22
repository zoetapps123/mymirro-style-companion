import { Plus, Shirt, Search, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  color: string;
  processed_image_url: string | null;
}

const Wardrobe = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    fetchWardrobeItems();
  }, []);

  const fetchWardrobeItems = async () => {
    const { data, error } = await supabase
      .from('wardrobe_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wardrobe:', error);
      return;
    }

    setItems(data || []);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setLoading(true);

    try {
      // Check auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to add items to your wardrobe",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;

        toast({
          title: "Processing image...",
          description: "Extracting clothing item and categorizing...",
        });

        // Process with AI
        const { data, error } = await supabase.functions.invoke('process-wardrobe', {
          body: { imageData }
        });

        if (error) throw error;

        // Upload processed image to storage
        const fileName = `${Date.now()}-${data.name.replace(/\s+/g, '-')}.png`;
        const base64Data = data.processedImageUrl.split(',')[1];
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/png' });

        const { error: uploadError } = await supabase.storage
          .from('outfits')
          .upload(fileName, blob);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('outfits')
          .getPublicUrl(fileName);

        // Save to database
        const { error: dbError } = await supabase
          .from('wardrobe_items')
          .insert({
            user_id: user.id,
            name: data.name,
            category: data.category,
            color: data.color,
            image_url: publicUrl,
            processed_image_url: publicUrl,
          });

        if (dbError) throw dbError;

        toast({
          title: "Item added!",
          description: `${data.name} has been added to your wardrobe.`,
        });

        fetchWardrobeItems();
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: "Error",
        description: "Failed to process image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = selectedCategory === "all" 
    ? items 
    : items.filter(item => item.category.toLowerCase() === selectedCategory);

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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageUpload}
          className="hidden"
          disabled={loading}
        />
        <Button 
          className="glow-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          <Camera className="w-5 h-5" />
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col">
        <TabsList className="glass-card border-border/50">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="tops">Tops</TabsTrigger>
          <TabsTrigger value="bottoms">Bottoms</TabsTrigger>
          <TabsTrigger value="layers">Layers</TabsTrigger>
          <TabsTrigger value="dresses">Dresses</TabsTrigger>
          <TabsTrigger value="shoes">Shoes</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="flex-1 mt-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Processing your image...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No items yet. Upload your first piece!
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="glass-card p-4 rounded-2xl space-y-3 hover:glow-accent transition-all cursor-pointer"
                >
                  <div className="aspect-square bg-muted/20 rounded-xl flex items-center justify-center overflow-hidden">
                    {item.processed_image_url ? (
                      <img 
                        src={item.processed_image_url} 
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Shirt className="w-16 h-16 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border-2 border-border"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-muted-foreground">Primary</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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