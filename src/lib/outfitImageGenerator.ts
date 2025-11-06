/**
 * Generates a composite outfit image by arranging wardrobe item images on a white background
 * This is a cost-effective alternative to AI image generation
 */

interface WardrobeItem {
  id: string;
  processed_image_url?: string;
  image_url: string;
}

export const generateOutfitComposite = async (items: WardrobeItem[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!items || items.length === 0) {
      reject(new Error('No items provided'));
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Set canvas size (square format)
    const canvasSize = 1200;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Calculate grid layout
    const itemCount = items.length;
    const columns = Math.min(3, Math.ceil(Math.sqrt(itemCount)));
    const rows = Math.ceil(itemCount / columns);
    
    const cellSize = canvasSize / Math.max(columns, rows);
    const padding = cellSize * 0.1;
    const imageSize = cellSize - (padding * 2);

    let loadedImages = 0;
    const images: Array<{ img: HTMLImageElement; index: number }> = [];

    items.forEach((item, index) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        images.push({ img, index });
        loadedImages++;

        if (loadedImages === items.length) {
          // All images loaded, draw them
          images.sort((a, b) => a.index - b.index);
          
          images.forEach(({ img, index }) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            
            const x = col * cellSize + padding;
            const y = row * cellSize + padding;

            // Calculate aspect ratio and scaling
            const imgAspect = img.width / img.height;
            let drawWidth = imageSize;
            let drawHeight = imageSize;
            
            if (imgAspect > 1) {
              // Landscape
              drawHeight = imageSize / imgAspect;
            } else {
              // Portrait
              drawWidth = imageSize * imgAspect;
            }

            // Center the image in its cell
            const offsetX = (imageSize - drawWidth) / 2;
            const offsetY = (imageSize - drawHeight) / 2;

            // Draw with slight shadow for depth
            ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;

            ctx.drawImage(
              img,
              x + offsetX,
              y + offsetY,
              drawWidth,
              drawHeight
            );

            // Reset shadow
            ctx.shadowColor = 'transparent';
          });

          // Convert to data URL
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          resolve(dataUrl);
        }
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image for item ${item.id}`));
      };

      img.src = item.processed_image_url || item.image_url;
    });
  });
};

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
};
