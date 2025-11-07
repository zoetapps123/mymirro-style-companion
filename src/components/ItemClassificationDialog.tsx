import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shirt, Footprints, User } from "lucide-react";
import { motion } from "framer-motion";

interface ItemClassificationDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (category: string) => void;
  itemPreview?: string;
}

const CATEGORIES = [
  { value: "shirt", label: "Shirt/Top", icon: Shirt },
  { value: "pants", label: "Pants/Bottom", icon: User },
  { value: "shoes", label: "Shoes", icon: Footprints },
];

export const ItemClassificationDialog = ({
  open,
  onClose,
  onSelect,
  itemPreview
}: ItemClassificationDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            Looks like we're unsure
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {itemPreview && (
            <div className="flex justify-center">
              <div className="w-32 h-32 bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                <img src={itemPreview} alt="Item" className="w-full h-full object-contain" />
              </div>
            </div>
          )}
          
          <p className="text-sm text-center text-muted-foreground">
            Is this a shirt, pant, or shoe?
          </p>

          <div className="grid grid-cols-3 gap-3">
            {CATEGORIES.map((category, idx) => {
              const Icon = category.icon;
              return (
                <motion.button
                  key={category.value}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => {
                    onSelect(category.value);
                    onClose();
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <Icon className="w-8 h-8 text-primary" />
                  <span className="text-xs font-medium text-center">{category.label}</span>
                </motion.button>
              );
            })}
          </div>

          <Button variant="ghost" onClick={onClose} className="w-full">
            Skip this item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
