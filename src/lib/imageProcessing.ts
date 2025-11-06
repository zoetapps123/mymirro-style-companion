/**
 * Advanced Image Processing for Wardrobe Items
 * Handles cropping, background removal, and border trimming
 */

/**
 * Smart background removal using edge detection and color analysis
 */
function removeBackgroundFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: { margin?: number; tolerance?: number } = {}
): HTMLCanvasElement {
  const margin = options.margin ?? 8;
  const tolerance = options.tolerance ?? 35;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample background color from borders
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  const samplePixel = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 10) return; // Skip transparent
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    count++;
  };

  // Sample from outer 2% border
  const borderWidth = Math.max(2, Math.floor(w * 0.02));
  const borderHeight = Math.max(2, Math.floor(h * 0.02));
  
  for (let x = 0; x < w; x++) {
    for (let t = 0; t < borderHeight; t++) {
      samplePixel(x, t);
      samplePixel(x, h - 1 - t);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let t = 0; t < borderWidth; t++) {
      samplePixel(t, y);
      samplePixel(w - 1 - t, y);
    }
  }

  if (count === 0) return sourceCanvas;

  const bgR = Math.round(rSum / count);
  const bgG = Math.round(gSum / count);
  const bgB = Math.round(bSum / count);

  console.log(`Background color detected: rgb(${bgR}, ${bgG}, ${bgB})`);

  const isBackground = (r: number, g: number, b: number, a: number) => {
    if (a < 10) return true;
    const distance = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
    return distance <= tolerance;
  };

  // Flood fill from borders to mark background pixels
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];

  const pushIfBg = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (isBackground(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      visited[idx] = 1;
      stack.push(x, y);
    }
  };

  // Start flood fill from all border pixels
  for (let x = 0; x < w; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushIfBg(0, y);
    pushIfBg(w - 1, y);
  }

  // Process flood fill
  while (stack.length) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    // Check 4-connected neighbors
    pushIfBg(x + 1, y);
    pushIfBg(x - 1, y);
    pushIfBg(x, y + 1);
    pushIfBg(x, y - 1);
  }

  // Find content bounds
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx]) continue; // Skip background
      const i = idx * 4;
      if (data[i + 3] < 10) continue; // Skip transparent
      
      // This is foreground content
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Validate bounds
  if (maxX < minX || maxY < minY) {
    console.warn('No foreground content found');
    return sourceCanvas;
  }

  // Apply margin
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(w - 1, maxX + margin);
  maxY = Math.min(h - 1, maxY + margin);

  const outW = maxX - minX + 1;
  const outH = maxY - minY + 1;

  // Create output canvas with transparent background
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return sourceCanvas;

  const outData = outCtx.createImageData(outW, outH);
  const outPixels = outData.data;

  // Copy non-background pixels
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const srcX = minX + x;
      const srcY = minY + y;
      const srcIdx = srcY * w + srcX;
      const srcI = srcIdx * 4;
      const outI = (y * outW + x) * 4;

      if (visited[srcIdx]) {
        // Background pixel - make transparent
        outPixels[outI + 3] = 0;
      } else {
        // Foreground pixel - copy as is
        outPixels[outI] = data[srcI];
        outPixels[outI + 1] = data[srcI + 1];
        outPixels[outI + 2] = data[srcI + 2];
        outPixels[outI + 3] = data[srcI + 3];
      }
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

/**
 * Trim transparent/white borders from image
 */
function trimTransparentBorders(
  sourceCanvas: HTMLCanvasElement,
  options: { margin?: number; threshold?: number } = {}
): HTMLCanvasElement {
  const margin = options.margin ?? 4;
  const threshold = options.threshold ?? 250;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  const { data } = ctx.getImageData(0, 0, w, h);

  const isEmptyPixel = (r: number, g: number, b: number, a: number) => {
    if (a < 10) return true; // Transparent
    if (r >= threshold && g >= threshold && b >= threshold) return true; // White
    return false;
  };

  // Find content bounds
  let top = 0, bottom = h - 1, left = 0, right = w - 1;

  // Find top
  topLoop: for (; top < h; top++) {
    for (let x = 0; x < w; x++) {
      const i = (top * w + x) * 4;
      if (!isEmptyPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        break topLoop;
      }
    }
  }

  // Find bottom
  bottomLoop: for (; bottom >= 0; bottom--) {
    for (let x = 0; x < w; x++) {
      const i = (bottom * w + x) * 4;
      if (!isEmptyPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        break bottomLoop;
      }
    }
  }

  // Find left
  leftLoop: for (; left < w; left++) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + left) * 4;
      if (!isEmptyPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        break leftLoop;
      }
    }
  }

  // Find right
  rightLoop: for (; right >= 0; right--) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + right) * 4;
      if (!isEmptyPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        break rightLoop;
      }
    }
  }

  // Validate bounds
  if (top > bottom || left > right) return sourceCanvas;

  // Apply margin
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
 * Crop images from composite using bounding box coordinates with smart background removal
 * @param compositeUrl URL of the composite image
 * @param items Items with bbox coordinates
 */
export const cropImageWithBoundingBoxes = async (
  compositeUrl: string,
  items: Array<{ bbox?: { x: number; y: number; width: number; height: number } }>
): Promise<Blob[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const croppedBlobs: (Blob | undefined)[] = new Array(items.length);
      let processedCount = 0;

      const finalizeIfDone = () => {
        if (processedCount === items.length) {
          resolve(croppedBlobs.filter(b => b !== undefined) as Blob[]);
        }
      };

      items.forEach((item, idx) => {
        if (!item.bbox) {
          console.warn(`Item ${idx} missing bbox, skipping`);
          processedCount++;
          finalizeIfDone();
          return;
        }

        const { x, y, width, height } = item.bbox;

        // Ensure pixel coordinates (not normalized)
        const pixelX = Math.max(0, Math.round(x));
        const pixelY = Math.max(0, Math.round(y));
        let pixelWidth = Math.max(1, Math.round(width));
        let pixelHeight = Math.max(1, Math.round(height));

        // Clamp to image bounds
        if (pixelX + pixelWidth > img.width) {
          pixelWidth = Math.max(1, img.width - pixelX);
        }
        if (pixelY + pixelHeight > img.height) {
          pixelHeight = Math.max(1, img.height - pixelY);
        }

        // Add expansion margin (3-5% of bbox size) to avoid cutting edges
        const expandX = Math.round(Math.max(12, pixelWidth * 0.05));
        const expandY = Math.round(Math.max(12, pixelHeight * 0.05));

        const expandedX = Math.max(0, pixelX - expandX);
        const expandedY = Math.max(0, pixelY - expandY);
        const expandedWidth = Math.min(
          img.width - expandedX,
          pixelWidth + expandX * 2
        );
        const expandedHeight = Math.min(
          img.height - expandedY,
          pixelHeight + expandY * 2
        );

        // Create canvas for expanded crop
        const canvas = document.createElement('canvas');
        canvas.width = expandedWidth;
        canvas.height = expandedHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          processedCount++;
          finalizeIfDone();
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw expanded region
        ctx.drawImage(
          img,
          expandedX,
          expandedY,
          expandedWidth,
          expandedHeight,
          0,
          0,
          expandedWidth,
          expandedHeight
        );

        // Remove background using smart flood fill
        const bgRemoved = removeBackgroundFromCanvas(canvas, {
          margin: 6,
          tolerance: 40
        });

        // Final trim of any remaining transparent/white borders
        const trimmed = trimTransparentBorders(bgRemoved, {
          margin: 5,
          threshold: 248
        });

        // Convert to blob
        trimmed.toBlob(
          (blob) => {
            if (blob) {
              croppedBlobs[idx] = blob;
              console.log(`Item ${idx} processed: ${trimmed.width}x${trimmed.height}`);
            } else {
              console.error(`Failed to create blob for item ${idx}`);
            }
            processedCount++;
            finalizeIfDone();
          },
          'image/png',
          1.0
        );
      });
    };

    img.onerror = () => reject(new Error('Failed to load composite image for bbox cropping'));
    img.src = compositeUrl;
  });
};

/**
 * Trim borders from an image blob (used for post-processing)
 */
export const trimImageBorders = async (blob: Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(blob);
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      const trimmed = trimTransparentBorders(canvas, { margin: 3, threshold: 245 });
      
      trimmed.toBlob(
        (newBlob) => {
          resolve(newBlob || blob);
        },
        'image/png',
        1.0
      );
    };
    img.onerror = () => reject(new Error('Failed to load image for trimming'));
    img.src = URL.createObjectURL(blob);
  });
};
