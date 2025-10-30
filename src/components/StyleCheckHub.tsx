import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera } from "lucide-react";

interface StyleCheckHubProps {
  onNavigate: (view: 'outfit-check' | 'outfit-battle') => void;
}

const StyleCheckHub = ({ onNavigate }: StyleCheckHubProps) => {
  const [selectedOccasion, setSelectedOccasion] = useState<string>("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const occasions = [
    "Casual Day Out",
    "Office",
    "Date",
    "Party",
    "Wedding",
    "Travel",
    "Interview",
    "Gym",
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const canStartCheck = uploadedImage && selectedOccasion;

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-4xl font-bold text-primary">Style Check</h1>
          <p className="text-muted-foreground mt-1 text-base">
            Pro score and quick fixes for your look
          </p>
        </div>

        {/* Where are you heading? */}
        <div>
          <h2 className="text-xl font-semibold text-primary mb-3">
            Where are you heading?
          </h2>
          <div className="flex gap-2 flex-wrap">
            {occasions.map((occasion) => (
              <Button
                key={occasion}
                variant={selectedOccasion === occasion ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedOccasion(occasion)}
                className={`rounded-full border-2 ${
                  selectedOccasion === occasion
                    ? "bg-white text-black border-black"
                    : "bg-transparent border-border text-foreground"
                }`}
              >
                {occasion}
              </Button>
            ))}
          </div>
        </div>

        {/* Upload Image */}
        <div>
          <label htmlFor="outfit-upload">
            <div className="bg-muted/30 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors min-h-[280px]">
              {uploadedImage ? (
                <img
                  src={uploadedImage}
                  alt="Uploaded outfit"
                  className="max-h-64 rounded-lg object-contain"
                />
              ) : (
                <>
                  <Camera className="w-16 h-16 text-primary" strokeWidth={1.5} />
                  <div className="text-center">
                    <p className="font-semibold text-lg">Upload an Image</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose where you're heading above
                    </p>
                  </div>
                </>
              )}
            </div>
          </label>
          <input
            id="outfit-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        {/* Battle of the fits */}
        <div>
          <h2 className="text-xl font-semibold text-primary mb-3">
            Battle of the fits
          </h2>
          <Card
            className="p-6 cursor-pointer hover:border-primary transition-colors relative overflow-hidden border-2 border-primary rounded-2xl"
            onClick={() => onNavigate('outfit-battle')}
          >
            <div className="absolute top-4 right-6 opacity-30">
              <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
                <text
                  x="0"
                  y="70"
                  fill="currentColor"
                  className="text-primary"
                  style={{
                    fontSize: "72px",
                    fontWeight: "bold",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}
                >
                  VS
                </text>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-primary mb-2">
              Outfit Battle
            </h3>
            <p className="text-muted-foreground mb-4 text-sm">
              Upload, compare, and crown the best outfit.
            </p>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full">
              Lets Fight!
            </Button>
          </Card>
        </div>

        {/* Start Check Button */}
        {canStartCheck && (
          <Button
            className="w-full h-12 text-lg rounded-full"
            onClick={() => onNavigate('outfit-check')}
          >
            Start Style Check
          </Button>
        )}
      </div>
    </div>
  );
};

export default StyleCheckHub;
