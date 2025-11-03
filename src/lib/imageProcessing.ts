/** Utility: trim white borders from a canvas, removing frames/margins introduced by the composite grid */
function trimWhiteBordersOnCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: { threshold?: number; margin?: number } = {}
): HTMLCanvasElement {
  const threshold = options.threshold ?? 245; // 0-255, higher = stricter white
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

  const isWhite = (r: number, g: number, b: number, a: number) => {
    if (a < 10) return true; // transparent counts as background
    return r >= threshold && g >= threshold && b >= threshold;
  };

  // Find top
  findTop: for (; top < h; top++) {
    for (let x = 0; x < w; x++) {
      const i = (top * w + x) * 4;
      if (!isWhite(data[i], data[i + 1], data[i + 2], data[i + 3])) break findTop;
    }
  }

  // Find bottom
  findBottom: for (; bottom >= 0; bottom--) {
    for (let x = 0; x < w; x++) {
      const i = (bottom * w + x) * 4;
      if (!isWhite(data[i], data[i + 1], data[i + 2], data[i + 3])) break findBottom;
    }
  }

  // Find left
  findLeft: for (; left < w; left++) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + left) * 4;
      if (!isWhite(data[i], data[i + 1], data[i + 2], data[i + 3])) break findLeft;
    }
  }

  // Find right
  findRight: for (; right >= 0; right--) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + right) * 4;
      if (!isWhite(data[i], data[i + 1], data[i + 2], data[i + 3])) break findRight;
    }
  }

  // If all white or invalid bounds, return original
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
 * - Also auto-trims white borders to remove any frames/margins
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

          // Trim white borders/frames inside the cell
          const trimmedCanvas = trimWhiteBordersOnCanvas(cellCanvas, {
            threshold: 245,
            margin: 4,
          });

          // Center the trimmed content in a square canvas
          const maxDim = Math.max(trimmedCanvas.width, trimmedCanvas.height);
          const centeredCanvas = document.createElement('canvas');
          centeredCanvas.width = maxDim;
          centeredCanvas.height = maxDim;
          const centeredCtx = centeredCanvas.getContext('2d');
          
          if (centeredCtx) {
            centeredCtx.imageSmoothingEnabled = true;
            centeredCtx.imageSmoothingQuality = 'high';
            
            // Draw trimmed content centered
            const offsetX = (maxDim - trimmedCanvas.width) / 2;
            const offsetY = (maxDim - trimmedCanvas.height) / 2;
            centeredCtx.drawImage(trimmedCanvas, offsetX, offsetY);
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
