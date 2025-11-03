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
  // Helper to detect simple separator lines and infer grid when backend layout is unreliable
  const detectGridFromSeparators = (img: HTMLImageElement) => {
    const w = img.width;
    const h = img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null as null | { rows: number; columns: number; cutsY: number[]; cutsX: number[] };
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;

    const isGrayish = (r: number, g: number, b: number) => {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const diff = max - min; // low saturation
      const bright = (r + g + b) / 3;
      return diff < 12 && bright > 160 && bright < 245; // typical grid divider gray
    };

    // Detect horizontal separators
    const sepRows: number[] = [];
    for (let y = 0; y < h; y++) {
      let grayCount = 0;
      let samples = 0;
      // Sample across width (stride ~8px)
      for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 120))) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a > 200) {
          samples++;
          if (isGrayish(r, g, b)) grayCount++;
        }
      }
      if (samples > 0 && grayCount / samples > 0.9) {
        sepRows.push(y);
      }
    }

    // Merge contiguous rows into bands and take midpoints
    const cutsY: number[] = [];
    if (sepRows.length) {
      let start = sepRows[0];
      let prev = sepRows[0];
      for (let i = 1; i < sepRows.length; i++) {
        if (sepRows[i] !== prev + 1) {
          cutsY.push(Math.round((start + prev) / 2));
          start = sepRows[i];
        }
        prev = sepRows[i];
      }
      cutsY.push(Math.round((start + prev) / 2));
    }

    // Detect vertical separators
    const sepCols: number[] = [];
    for (let x = 0; x < w; x++) {
      let grayCount = 0;
      let samples = 0;
      for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 120))) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a > 200) {
          samples++;
          if (isGrayish(r, g, b)) grayCount++;
        }
      }
      if (samples > 0 && grayCount / samples > 0.9) {
        sepCols.push(x);
      }
    }
    const cutsX: number[] = [];
    if (sepCols.length) {
      let start = sepCols[0];
      let prev = sepCols[0];
      for (let i = 1; i < sepCols.length; i++) {
        if (sepCols[i] !== prev + 1) {
          cutsX.push(Math.round((start + prev) / 2));
          start = sepCols[i];
        }
        prev = sepCols[i];
      }
      cutsX.push(Math.round((start + prev) / 2));
    }

    const rows = cutsY.length + 1;
    const columns = cutsX.length + 1;
    if (rows === 1 && columns === 1) return null; // no grid detected
    return { rows, columns, cutsY, cutsX };
  };

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let { rows, columns, itemCount } = gridLayout;

      // If backend layout seems inconsistent, try auto-detecting grid
      if (!rows || !columns || rows * columns < Math.min(itemCount || 1, 100)) {
        const detected = detectGridFromSeparators(img);
        if (detected) {
          rows = detected.rows;
          columns = detected.columns;
        }
      }

      // Fallback safety
      rows = Math.max(1, Math.floor(rows));
      columns = Math.max(1, Math.floor(columns));
      const expectedCells = Math.min(itemCount || rows * columns, rows * columns);

      const cellWidth = Math.round(img.width / columns);
      const cellHeight = Math.round(img.height / rows);

      const croppedBlobs: Blob[] = [];
      let processedCount = 0;

      const finalizeIfDone = () => {
        if (processedCount === expectedCells) resolve(croppedBlobs);
      };

      // Process each cell up to expectedCells
      outer: for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const itemIndex = row * columns + col;
          if (itemIndex >= expectedCells) break outer;

          const sx = col * cellWidth;
          const sy = row * cellHeight;
          const sw = (col === columns - 1) ? img.width - sx : cellWidth;
          const sh = (row === rows - 1) ? img.height - sy : cellHeight;

          const cellCanvas = document.createElement('canvas');
          cellCanvas.width = sw;
          cellCanvas.height = sh;
          const cellCtx = cellCanvas.getContext('2d');
          if (!cellCtx) {
            processedCount++;
            finalizeIfDone();
            continue;
          }

          cellCtx.imageSmoothingEnabled = true;
          cellCtx.imageSmoothingQuality = 'high';

          cellCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

          // Optionally trim borders to remove internal grid lines
          const trimmed = trimBordersOnCanvas(cellCanvas, { margin: 2, whiteThreshold: 240 });

          trimmed.toBlob(
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
      
      // Trim borders - more aggressive to remove grey frames
      const trimmed = trimBordersOnCanvas(canvas, {
        whiteThreshold: 200, // Catch light grey/beige backgrounds
        blackThreshold: 60, // Catch dark grey backgrounds
        margin: 2, // Minimal margin to avoid grey borders
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
