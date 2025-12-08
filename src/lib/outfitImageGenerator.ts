/**
 * Generates a composite outfit image by arranging wardrobe item images on a white background
 * This is a cost-effective alternative to AI image generation
 */

interface WardrobeItem {
  id: string;
  processed_image_url?: string;
  image_url: string;
}

/**
 * Load an image with retry logic and exponential backoff
 */
const loadImageWithRetry = (
  url: string, 
  maxRetries = 3, 
  initialDelayMs = 500
): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const tryLoad = () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => resolve(img);
      
      img.onerror = () => {
        attempts++;
        if (attempts < maxRetries) {
          const delay = initialDelayMs * Math.pow(2, attempts - 1);
          console.log(`Image load failed, retrying in ${delay}ms (attempt ${attempts}/${maxRetries})`);
          setTimeout(tryLoad, delay);
        } else {
          reject(new Error(`Failed to load image after ${maxRetries} attempts: ${url}`));
        }
      };
      
      img.src = url;
    };
    
    tryLoad();
  });
};

/**
 * Load images sequentially with limited concurrency to avoid net::ERR_FAILED
 */
const loadImagesSequentially = async (
  items: WardrobeItem[]
): Promise<Array<{ img: HTMLImageElement; index: number } | null>> => {
  const results: Array<{ img: HTMLImageElement; index: number } | null> = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const url = item.processed_image_url || item.image_url;
    
    try {
      const img = await loadImageWithRetry(url);
      results.push({ img, index: i });
    } catch (error) {
      console.warn(`Failed to load image for item ${item.id}:`, error);
      results.push(null); // Mark as failed but continue
    }
  }
  
  return results;
};

export const generateOutfitComposite = async (items: WardrobeItem[]): Promise<string> => {
  if (!items || items.length === 0) {
    throw new Error('No items provided');
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Set canvas size (square format)
  const canvasSize = 1200;
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  // Fill with white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Load images sequentially to avoid connection limits
  const loadedImages = await loadImagesSequentially(items);
  
  // Filter out failed images
  const successfulImages = loadedImages.filter(
    (result): result is { img: HTMLImageElement; index: number } => result !== null
  );
  
  // If all images failed, throw error
  if (successfulImages.length === 0) {
    throw new Error('Failed to load any images for the outfit');
  }

  // Calculate grid layout based on successful images
  const itemCount = successfulImages.length;
  const columns = Math.min(3, Math.ceil(Math.sqrt(itemCount)));
  const rows = Math.ceil(itemCount / columns);
  
  const cellSize = canvasSize / Math.max(columns, rows);
  const padding = cellSize * 0.1;
  const imageSize = cellSize - (padding * 2);

  // Draw images in grid
  successfulImages.forEach(({ img }, displayIndex) => {
    const col = displayIndex % columns;
    const row = Math.floor(displayIndex / columns);
    
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
  return canvas.toDataURL('image/png', 0.9);
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
