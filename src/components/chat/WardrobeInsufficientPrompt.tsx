import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WardrobeInsufficientPromptProps {
  missingCategories: string[];
  reason: string;
}

export const WardrobeInsufficientPrompt = ({ 
  missingCategories, 
  reason 
}: WardrobeInsufficientPromptProps) => {
  const navigate = useNavigate();

  return (
    <Card className="p-4 bg-accent/20 border-accent/40 my-3 space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-accent/30 shrink-0">
          <AlertCircle className="w-5 h-5 text-accent-foreground" />
        </div>
        <div className="space-y-2 flex-1">
          <h4 className="font-semibold text-sm">Upload Items to Get Outfits</h4>
          <p className="text-sm text-muted-foreground">{reason}</p>
          
          {missingCategories.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Missing categories:</p>
              <div className="flex flex-wrap gap-2">
                {missingCategories.map(cat => (
                  <span 
                    key={cat} 
                    className="px-2 py-1 bg-accent/40 text-accent-foreground rounded-md text-xs font-medium capitalize"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Button 
        onClick={() => navigate('/?tab=wardrobe&action=upload')}
        className="w-full"
        size="sm"
      >
        <Upload className="w-4 h-4 mr-2" />
        Upload Items to Wardrobe
      </Button>
    </Card>
  );
};
