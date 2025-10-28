import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  image_url: string;
  processed_image_url: string;
  color: string;
}

interface Outfit {
  id: string;
  items: WardrobeItem[];
  type: 'style' | 'occasion' | 'item';
  label: string;
}

interface OutfitDetailEditorProps {
  outfit: Outfit;
  wardrobeItems: WardrobeItem[];
  onBack: () => void;
  onSave: () => void;
}

const OutfitDetailEditor = ({ outfit, wardrobeItems, onBack, onSave }: OutfitDetailEditorProps) => {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<WardrobeItem[]>(outfit.items);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [outfitName, setOutfitName] = useState("");
  const [showTemplate, setShowTemplate] = useState(true);

  const removeItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };

  const addItem = (item: WardrobeItem) => {
    if (!selectedItems.find(i => i.id === item.id)) {
      setSelectedItems(prev => [...prev, item]);
    }
  };

  const saveOutfit = async () => {
    if (!outfitName.trim()) {
      toast({
        title: "Name required",
        description: "Please give your outfit a name.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: savedOutfit, error: outfitError } = await supabase
        .from('outfits')
        .insert({
          user_id: user.id,
          name: outfitName,
          occasion: outfit.label
        })
        .select()
        .single();

      if (outfitError) throw outfitError;

      const outfitItems = selectedItems.map(item => ({
        outfit_id: savedOutfit.id,
        item_id: item.id,
        ai_virtual: false,
        item_type: item.category
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
      onSave();
    } catch (error) {
      console.error('Error saving outfit:', error);
      toast({
        title: "Error",
        description: "Failed to save outfit.",
        variant: "destructive",
      });
    }
  };

  const relatedItems = wardrobeItems.filter(
    item => !selectedItems.find(selected => selected.id === item.id)
  );

  // Template preview view
  if (showTemplate) {
    return (
      <div className="flex flex-col h-full p-4 space-y-6 overflow-y-auto">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gradient-primary">{outfit.label}</h2>
          <p className="text-sm text-muted-foreground">Preview your outfit template</p>
        </div>

        {/* Large Template Preview */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="grid grid-cols-2 gap-4">
            {selectedItems.slice(0, 4).map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="aspect-square bg-gray-50 rounded-xl overflow-hidden p-4"
              >
                <img
                  src={item.processed_image_url}
                  alt={item.name}
                  className="w-full h-full object-contain"
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 sticky bottom-0 bg-background pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button onClick={() => setShowTemplate(false)} className="flex-1">
            Edit & Customize
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gradient-primary">Edit Outfit</h2>
        <p className="text-sm text-muted-foreground">{outfit.label}</p>
      </div>

      {/* Current Outfit Items */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Current Items</h3>
        <div className="grid grid-cols-2 gap-3">
          {selectedItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white rounded-xl p-3"
            >
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full"
                onClick={() => removeItem(item.id)}
              >
                <X className="w-3 h-3" />
              </Button>
              <div className="aspect-square mb-2">
                <img
                  src={item.processed_image_url}
                  alt={item.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-xs font-medium text-foreground text-center">{item.name}</p>
              <p className="text-xs text-muted-foreground text-center">{item.category}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Related Items to Add */}
      {relatedItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Add from Wardrobe</h3>
          <div className="grid grid-cols-3 gap-2">
            {relatedItems.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative bg-white rounded-lg p-2 cursor-pointer"
                onClick={() => addItem(item)}
              >
                <div className="aspect-square mb-1">
                  <img
                    src={item.processed_image_url}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-xs text-foreground text-center truncate">{item.name}</p>
                <div className="absolute inset-0 bg-primary/10 opacity-0 hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 sticky bottom-0 bg-background pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={() => setShowSaveDialog(true)} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save Outfit
        </Button>
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
              placeholder={`${outfit.label} #1`}
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

export default OutfitDetailEditor;
