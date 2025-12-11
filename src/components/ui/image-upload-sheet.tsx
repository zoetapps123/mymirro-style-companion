import React, { useRef } from "react";
import { Camera, ImageIcon, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface ImageUploadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  multiple?: boolean;
  disabled?: boolean;
  title?: string;
}

export function ImageUploadSheet({
  open,
  onOpenChange,
  onFileSelect,
  multiple = false,
  disabled = false,
  title = "Add Photo",
}: ImageUploadSheetProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    galleryInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-8">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
          </div>
        </SheetHeader>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Camera Option */}
          <Button
            variant="outline"
            className="h-28 flex-col gap-3 rounded-2xl border-2 border-dashed hover:border-primary hover:bg-primary/5"
            onClick={handleCameraClick}
            disabled={disabled}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <span className="text-sm font-medium">Take Photo</span>
          </Button>
          
          {/* Gallery Option */}
          <Button
            variant="outline"
            className="h-28 flex-col gap-3 rounded-2xl border-2 border-dashed hover:border-accent hover:bg-accent/5"
            onClick={handleGalleryClick}
            disabled={disabled}
          >
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-accent" />
            </div>
            <span className="text-sm font-medium">Gallery</span>
          </Button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
      </SheetContent>
    </Sheet>
  );
}

// Hook to manage upload sheet state
export function useImageUploadSheet() {
  const [isOpen, setIsOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const desktopInputRef = useRef<HTMLInputElement>(null);

  const openUpload = () => {
    if (isMobile) {
      setIsOpen(true);
    } else {
      desktopInputRef.current?.click();
    }
  };

  return {
    isOpen,
    setIsOpen,
    isMobile,
    desktopInputRef,
    openUpload,
  };
}
