import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, Camera, Loader2, Shirt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface GenerateOutfitsProps {
  onBack: () => void;
}

const occasions = [
  "Casual Day Out",
  "Office",
  "Dinner Date",
  "Party",
  "Wedding",
  "Travel",
  "Interview"
];

const dressCodes = ["Relaxed", "Smart Casual", "Semi-Formal", "Formal"];

const GenerateOutfits = ({ onBack }: GenerateOutfitsProps) => {
  const { toast } = useToast();
  const [selectedOccasion, setSelectedOccasion] = useState(occasions[0]);
  const [selectedDressCode, setSelectedDressCode] = useState(dressCodes[0]);
  const [loading, setLoading] = useState(false);
  const [outfit, setOutfit] = useState<any>(null);
  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [outfitName, setOutfitName] = useState("");

  useEffect(() => {
    fetchWardrobeItems();
  }, []);

  const fetchWardrobeItems = async () => {
    const { data } = await supabase
      .from('wardrobe_items')
      .select('*');
    setWardrobeItems(data || []);
  };

  const generateOutfit = async () => {
    if (wardrobeItems.length === 0) {
      toast({
        title: "Empty wardrobe",
        description: "Your wardrobe is empty. Add items (don't be lazy :P)",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Calling generate-outfit with:', {
        occasion: selectedOccasion,
        dressCode: selectedDressCode,
        itemCount: wardrobeItems.length
      });

      const { data, error } = await supabase.functions.invoke('generate-outfit', {
        body: {
          occasion: selectedOccasion,
          dressCode: selectedDressCode,
          weatherContext: "Comfortable",
          userItems: wardrobeItems
        }
      });

      if (error) {
        console.error('Generate outfit error:', error);
        throw error;
      }

      console.log('Generated outfit:', data);
      setOutfit(data.outfit);
      toast({
        title: "Outfit generated!",
        description: data.reasoning,
      });
    } catch (error) {
      console.error('Error generating outfit:', error);
      toast({
        title: "Error",
        description: "Failed to generate outfit. Try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveOutfit = async () => {
    if (!outfit || !outfitName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: savedOutfit, error: outfitError } = await supabase
        .from('outfits')
        .insert({
          user_id: user.id,
          name: outfitName,
          occasion: selectedOccasion
        })
        .select()
        .single();

      if (outfitError) throw outfitError;

      const outfitItems = Object.entries(outfit)
        .filter(([_, item]: any) => item)
        .map(([type, item]: any) => ({
          outfit_id: savedOutfit.id,
          item_id: item.useExisting ? item.itemId : null,
          ai_virtual: !item.useExisting,
          ai_meta: !item.useExisting ? { suggestion: item.aiSuggestion } : null,
          item_type: type
        }));

      const { error: itemsError } = await supabase
        .from('outfit_items')
        .insert(outfitItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Outfit saved!",
        description: `"${outfitName}" is ready in your collection.`,
      });

      setShowSaveDialog(false);
      setOutfitName("");
    } catch (error) {
      console.error('Error saving outfit:', error);
      toast({
        title: "Error",
        description: "Failed to save outfit.",
        variant: "destructive",
      });
    }
  };

  const renderOutfitItem = (type: string, item: any) => {
    if (!item) return null;

    const wardrobeItem = item.useExisting 
      ? wardrobeItems.find(w => w.id === item.itemId)
      : null;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-4 rounded-xl space-y-3"
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium capitalize">{type}</h4>
          {!item.useExisting && (
            <Badge variant="secondary" className="text-xs">AI Suggestion</Badge>
          )}
        </div>
        
        <div className="aspect-square bg-muted/20 rounded-lg flex items-center justify-center overflow-hidden">
          {wardrobeItem?.processed_image_url ? (
            <img 
              src={wardrobeItem.processed_image_url} 
              alt={wardrobeItem.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <Shirt className="w-12 h-12 text-muted-foreground" />
          )}
        </div>

        <div>
          <p className="text-sm font-medium">
            {item.useExisting ? item.itemName : item.aiSuggestion}
          </p>
          {!item.useExisting && (
            <p className="text-xs text-muted-foreground mt-1">
              Complete the look with this piece
            </p>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Generate Outfits</h2>
        <p className="text-sm text-muted-foreground">
          Create complete looks from your wardrobe
        </p>
      </div>

      {/* Occasion Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Occasion</label>
        <div className="flex flex-wrap gap-2">
          {occasions.map(occasion => (
            <Badge
              key={occasion}
              variant={selectedOccasion === occasion ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedOccasion(occasion)}
            >
              {occasion}
            </Badge>
          ))}
        </div>
      </div>

      {/* Dress Code */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Dress Code</label>
        <div className="flex flex-wrap gap-2">
          {dressCodes.map(code => (
            <Badge
              key={code}
              variant={selectedDressCode === code ? "secondary" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedDressCode(code)}
            >
              {code}
            </Badge>
          ))}
        </div>
      </div>

      {/* Outfit Canvas */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-full"
            >
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">Creating your perfect look...</p>
              </div>
            </motion.div>
          ) : outfit ? (
            <motion.div
              key="outfit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">
                  Here's a clean balanced look for your event. Wanna see how it looks on you? Hit Try On!
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {renderOutfitItem('top', outfit.top)}
                {renderOutfitItem('bottom', outfit.bottom)}
                {renderOutfitItem('layer', outfit.layer)}
                {renderOutfitItem('shoes', outfit.shoes)}
                {renderOutfitItem('accessories', outfit.accessories)}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-full"
            >
              <div className="text-center space-y-4">
                <Sparkles className="w-16 h-16 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  {wardrobeItems.length === 0 
                    ? "Your wardrobe is empty. Add items (don't be lazy :P)" 
                    : "Ready to create your look?"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={generateOutfit}
          disabled={loading || wardrobeItems.length === 0}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {outfit ? "Show me more combos" : "Generate New"}
        </Button>
        {outfit && (
          <>
            <Button
              variant="secondary"
              onClick={() => setShowSaveDialog(true)}
              disabled={loading}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button 
              variant="secondary"
              disabled={loading}
              onClick={() => toast({
                title: "Try On coming soon!",
                description: "Upload a clear photo in good light, bro/girl — trust me, your fit deserves it :P"
              })}
            >
              <Camera className="w-4 h-4 mr-2" />
              Try On
            </Button>
          </>
        )}
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Outfit</DialogTitle>
            <DialogDescription>
              Give your outfit a name to save it to your collection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={`${selectedOccasion} Look #1`}
              value={outfitName}
              onChange={(e) => setOutfitName(e.target.value)}
            />
            <Button onClick={saveOutfit} className="w-full" disabled={!outfitName.trim()}>
              Save Outfit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GenerateOutfits;
