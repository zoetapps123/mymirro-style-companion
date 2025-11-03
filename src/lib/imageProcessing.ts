/** Utility: trim white OR black borders from a canvas, removing frames/margins introduced by the composite grid or AI completion */
function trimBordersOnCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: { whiteThreshold?: number; blackThreshold?: number; margin?: number } = {}
): HTMLCanvasElement {
  const whiteThreshold = options.whiteThreshold ?? 245; // 0-255, higher = stricter white
  const blackThreshold = options.blackThreshold ?? 15; // 0-255, lower = stricter black
  const margin = options.margin ?? 6; // keep a small padding after trim

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  const { data } = ctx.getImageData(0, 0, w, h);

  let top = 0,
    bottom = h - 1,
    left = 0,
    right = w - 1;

  const isBorderColor = (r: number, g: number, b: number, a: number) => {
    if (a < 10) return true; // transparent counts as background
    // Check if it's white
    if (r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) return true;
    // Check if it's black
    if (r <= blackThreshold && g <= blackThreshold && b <= blackThreshold) return true;
    return false;
  };

  // Find top
  findTop: for (; top < h; top++) {
    for (let x = 0; x < w; x++) {
      const i = (top * w + x) * 4;
      if (!isBorderColor(data[i], data[i + 1], data[i + 2], data[i + 3])) break findTop;
    }
  }

  // Find bottom
  findBottom: for (; bottom >= 0; bottom--) {
    for (let x = 0; x < w; x++) {
      const i = (bottom * w + x) * 4;
      if (!isBorderColor(data[i], data[i + 1], data[i + 2], data[i + 3])) break findBottom;
    }
  }

  // Find left
  findLeft: for (; left < w; left++) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + left) * 4;
      if (!isBorderColor(data[i], data[i + 1], data[i + 2], data[i + 3])) break findLeft;
    }
  }

  // Find right
  findRight: for (; right >= 0; right--) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + right) * 4;
      if (!isBorderColor(data[i], data[i + 1], data[i + 2], data[i + 3])) break findRight;
    }
  }

  // If all border color or invalid bounds, return original
  if (top > bottom || left > right) return sourceCanvas;

  const sx = Math.max(0, left - margin);
  const sy = Math.max(0, top - margin);
  const sw = Math.min(w - sx, right - left + 1 + margin * 2);
  const sh = Math.min(h - sy, bottom - top + 1 + margin * 2);

  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  const outCtx = out.getContext('2d');
  if (!outCtx) return sourceCanvas;
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

/**
 * Crops individual items from a composite image grid
 * - Also auto-trims white and black borders to remove any frames/margins
 * @param compositeImageUrl - Base64 data URL of the composite image
 * @param gridLayout - Layout information (rows, columns, itemCount)
 * @returns Array of cropped image blobs
 */
export const cropCompositeImage = async (
  compositeImageUrl: string,
  gridLayout: { rows: number; columns: number; itemCount: number }
): Promise<Blob[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const { rows, columns, itemCount } = gridLayout;
      const cellWidth = img.width / columns;
      const cellHeight = img.height / rows;

      const croppedBlobs: Blob[] = [];
      let processedCount = 0;

      const finalizeIfDone = () => {
        if (processedCount === itemCount) resolve(croppedBlobs);
      };

      // Process each cell
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const itemIndex = row * columns + col;
          if (itemIndex >= itemCount) break;

          const cellCanvas = document.createElement('canvas');
          cellCanvas.width = cellWidth;
          cellCanvas.height = cellHeight;
          const cellCtx = cellCanvas.getContext('2d');
          if (!cellCtx) {
            processedCount++;
            finalizeIfDone();
            continue;
          }

          cellCtx.imageSmoothingEnabled = true;
          cellCtx.imageSmoothingQuality = 'high';

          // Draw the specific cell
          cellCtx.drawImage(
            img,
            col * cellWidth, // sx
            row * cellHeight, // sy
            cellWidth, // sw
            cellHeight, // sh
            0,
            0,
            cellWidth,
            cellHeight
          );

          // No trimming here - will trim after AI completion
          // Just center the content in a square canvas
          const maxDim = Math.max(cellCanvas.width, cellCanvas.height);
          const centeredCanvas = document.createElement('canvas');
          centeredCanvas.width = maxDim;
          centeredCanvas.height = maxDim;
          const centeredCtx = centeredCanvas.getContext('2d');
          
          if (centeredCtx) {
            centeredCtx.imageSmoothingEnabled = true;
            centeredCtx.imageSmoothingQuality = 'high';
            
            // Draw cell centered
            const offsetX = (maxDim - cellCanvas.width) / 2;
            const offsetY = (maxDim - cellCanvas.height) / 2;
            centeredCtx.drawImage(cellCanvas, offsetX, offsetY);
          }

          centeredCanvas.toBlob(
            (blob) => {
              if (blob) {
                croppedBlobs.push(blob);
              }
              processedCount++;
              finalizeIfDone();
            },
            'image/png',
            1.0
          );
        }
      }
    };

    img.onerror = () => reject(new Error('Failed to load composite image'));
    img.src = compositeImageUrl;
  });
};

/**
 * Converts a blob to a base64 data URL
 */
export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Trims borders from an image blob
 * @param blob - Image blob to process
 * @returns Trimmed image blob
 */
export const trimImageBorders = async (blob: Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      
      // Trim borders
      const trimmed = trimBordersOnCanvas(canvas, {
        whiteThreshold: 245,
        blackThreshold: 30, // More aggressive black detection
        margin: 4,
      });
      
      // Convert to blob
      trimmed.toBlob((resultBlob) => {
        if (resultBlob) {
          resolve(resultBlob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/png', 1.0);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
};
