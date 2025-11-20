import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WardrobeInsufficientPromptProps {
  missingCategories: string[];
  reason: string;
  isRecommendation?: boolean;
}

export const WardrobeInsufficientPrompt = ({ 
  missingCategories, 
  reason,
  isRecommendation = false 
}: WardrobeInsufficientPromptProps) => {
  const navigate = useNavigate();

  // Different styling for recommendations vs. blockers
  const containerClass = isRecommendation 
    ? "p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 my-3 space-y-3"
    : "p-4 bg-accent/20 border-accent/40 my-3 space-y-3";
    
  const iconColor = isRecommendation 
    ? "text-blue-600 dark:text-blue-400" 
    : "text-accent-foreground";
    
  const title = isRecommendation 
    ? "💡 Upgrade Your Wardrobe" 
    : "Upload Items to Get Outfits";

  return (
    <Card className={containerClass}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${isRecommendation ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-accent/30'} shrink-0`}>
          <AlertCircle className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="space-y-2 flex-1">
          <h4 className="font-semibold text-sm">{title}</h4>
          <p className="text-sm text-muted-foreground">{reason}</p>
          
          {missingCategories.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {isRecommendation ? "Recommended additions:" : "Missing categories:"}
              </p>
              <div className="flex flex-wrap gap-2">
                {missingCategories.map(cat => (
                  <span 
                    key={cat} 
                    className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${
                      isRecommendation 
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' 
                        : 'bg-accent/40 text-accent-foreground'
                    }`}
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
        variant={isRecommendation ? "outline" : "default"}
      >
        <Upload className="w-4 h-4 mr-2" />
        {isRecommendation ? "Add Recommended Items" : "Upload Items to Wardrobe"}
      </Button>
    </Card>
  );
};
