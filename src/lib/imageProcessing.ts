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
    // Treat very light gray separators as background (low saturation, high brightness)
    const maxRGB = Math.max(r, g, b);
    const minRGB = Math.min(r, g, b);
    const diff = maxRGB - minRGB; // saturation proxy
    const bright = (r + g + b) / 3;
    if (diff < 12 && bright > 225) return true; // thin gray grid lines
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

// Robust background-aware trim using border flood-fill
function smartTrimCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: { margin?: number; bgTolerance?: number; dilate?: number } = {}
): HTMLCanvasElement {
  const margin = options.margin ?? 3;
  const tol = options.bgTolerance ?? 32; // RGB Manhattan distance to consider background
  const dilate = options.dilate ?? 2; // expand final bounds a bit to avoid cutting edges

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample background color from outer ring (avoid single outliers)
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const a = data[i + 3];
    if (a < 10) return;
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    count++;
  };
  const ring = Math.max(1, Math.floor(Math.min(w, h) * 0.01));
  for (let x = 0; x < w; x++) {
    for (let t = 0; t < ring; t++) {
      sample(x, t);
      sample(x, h - 1 - t);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let t = 0; t < ring; t++) {
      sample(t, y);
      sample(w - 1 - t, y);
    }
  }
  if (count === 0) return sourceCanvas;
  const bgR = Math.round(rSum / count), bgG = Math.round(gSum / count), bgB = Math.round(bSum / count);
  const isBg = (r: number, g: number, b: number, a: number) => {
    if (a < 10) return true;
    const d = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
    return d <= tol;
  };

  // Flood fill from borders to mark background-connected pixels
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const pushIfBg = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const i = (idx << 2);
    if (isBg(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      visited[idx] = 1;
      stack.push(x, y);
    }
  };
  for (let x = 0; x < w; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushIfBg(0, y);
    pushIfBg(w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    const neigh = [x + 1, y, x - 1, y, x, y + 1, x, y - 1];
    for (let k = 0; k < neigh.length; k += 2) {
      const nx = neigh[k], ny = neigh[k + 1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nidx = ny * w + nx;
      if (visited[nidx]) continue;
      const i = (nidx << 2);
      if (isBg(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        visited[nidx] = 1;
        stack.push(nx, ny);
      }
    }
  }

  // Find content bounds (pixels not marked as background)
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx]) continue;
      const i = (idx << 2);
      if (data[i + 3] < 10) continue; // ignore fully transparent
      const d = Math.abs(data[i] - bgR) + Math.abs(data[i + 1] - bgG) + Math.abs(data[i + 2] - bgB);
      if (d > Math.max(10, tol * 0.6)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    // Fallback to simple trim
    return trimBordersOnCanvas(sourceCanvas, { margin });
  }

  // Optional: isolate largest foreground component to drop inner frames
  {
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const compVisited = new Uint8Array(bw * bh);
    const isContent = (x: number, y: number) => {
      const gx = minX + x;
      const gy = minY + y;
      const idx = gy * w + gx;
      if (idx < 0 || idx >= w * h) return false;
      if (visited[idx]) return false; // background
      const i = (idx << 2);
      const d = Math.abs(data[i] - bgR) + Math.abs(data[i + 1] - bgG) + Math.abs(data[i + 2] - bgB);
      return d > Math.max(10, tol * 0.6);
    };

    // Morphological open (erode then dilate) once to remove thin frame lines
    const mask = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) mask[y * bw + x] = isContent(x, y) ? 1 : 0;
    }
    const eroded = new Uint8Array(bw * bh);
    for (let y = 1; y < bh - 1; y++) {
      for (let x = 1; x < bw - 1; x++) {
        let ok = 1;
        for (let yy = -1; yy <= 1 && ok; yy++)
          for (let xx = -1; xx <= 1 && ok; xx++)
            if (!mask[(y + yy) * bw + (x + xx)]) ok = 0;
        eroded[y * bw + x] = ok;
      }
    }
    const opened = new Uint8Array(bw * bh);
    for (let y = 1; y < bh - 1; y++) {
      for (let x = 1; x < bw - 1; x++) {
        let any = 0;
        for (let yy = -1; yy <= 1 && !any; yy++)
          for (let xx = -1; xx <= 1 && !any; xx++)
            if (eroded[(y + yy) * bw + (x + xx)]) any = 1;
        opened[y * bw + x] = any;
      }
    }

    // Connected components on opened mask; pick largest area
    let bestArea = 0, bestMinX = 0, bestMinY = 0, bestMaxX = bw - 1, bestMaxY = bh - 1;
    for (let sy = 0; sy < bh; sy++) {
      for (let sx = 0; sx < bw; sx++) {
        const si = sy * bw + sx;
        if (!opened[si] || compVisited[si]) continue;
        let area = 0;
        let cminX = sx, cmaxX = sx, cminY = sy, cmaxY = sy;
        const st: number[] = [sx, sy];
        compVisited[si] = 1;
        while (st.length) {
          const y = st.pop() as number; const x = st.pop() as number;
          area++;
          if (x < cminX) cminX = x; if (x > cmaxX) cmaxX = x;
          if (y < cminY) cminY = y; if (y > cmaxY) cmaxY = y;
          const neigh = [x + 1, y, x - 1, y, x, y + 1, x, y - 1];
          for (let k = 0; k < neigh.length; k += 2) {
            const nx = neigh[k], ny = neigh[k + 1];
            if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
            const ni = ny * bw + nx;
            if (compVisited[ni] || !opened[ni]) continue;
            compVisited[ni] = 1;
            st.push(nx, ny);
          }
        }
        if (area > bestArea) {
          bestArea = area;
          bestMinX = cminX; bestMaxX = cmaxX; bestMinY = cminY; bestMaxY = cmaxY;
        }
      }
    }

    const totalContent = mask.reduce((a, v) => a + (v ? 1 : 0), 0);
    if (bestArea > 0 && totalContent > 0 && bestArea >= totalContent * 0.35) {
      // Use largest component bounds (mapped back to global)
      minX = minX + bestMinX;
      maxX = minX + (bestMaxX - bestMinX);
      minY = minY + bestMinY;
      maxY = minY + (bestMaxY - bestMinY);
    }
  }

  // Apply small dilation and margin
  minX = Math.max(0, minX - (margin + dilate));
  minY = Math.max(0, minY - (margin + dilate));
  maxX = Math.min(w - 1, maxX + (margin + dilate));
  maxY = Math.min(h - 1, maxY + (margin + dilate));

  const outW = Math.max(1, maxX - minX + 1);
  const outH = Math.max(1, maxY - minY + 1);
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d');
  if (!octx) return sourceCanvas;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(sourceCanvas, minX, minY, outW, outH, 0, 0, outW, outH);
  return out;
}

/**
 * Crops images from the original source using bounding box coordinates
 * @param imageUrl - Original image URL
 * @param items - Array of items with bbox coordinates
 * @returns Array of cropped image blobs
 */
export const cropImageWithBoundingBoxes = async (
  imageUrl: string,
  items: Array<{ bbox?: { x: number; y: number; width: number; height: number } }>
): Promise<Blob[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const croppedBlobs: (Blob | undefined)[] = new Array(items.length);
      let processedCount = 0;

      const finalizeIfDone = () => {
        if (processedCount === items.length) resolve(croppedBlobs as Blob[]);
      };

      items.forEach((item, idx) => {
        if (!item.bbox) {
          console.warn(`Item ${idx} missing bbox, skipping`);
          processedCount++;
          finalizeIfDone();
          return;
        }

        const { x, y, width, height } = item.bbox;
        
        // Support both normalized [0-1] and absolute pixel coordinates
        const looksNormalized = x <= 1 && y <= 1 && width <= 1 && height <= 1;
        let pixelX: number, pixelY: number, pixelWidth: number, pixelHeight: number;

        if (looksNormalized) {
          pixelX = Math.round(x * img.width);
          pixelY = Math.round(y * img.height);
          pixelWidth = Math.max(1, Math.round(width * img.width));
          pixelHeight = Math.max(1, Math.round(height * img.height));
        } else {
          pixelX = Math.max(0, Math.round(x));
          pixelY = Math.max(0, Math.round(y));
          pixelWidth = Math.max(1, Math.round(width));
          pixelHeight = Math.max(1, Math.round(height));
        }

        // Clamp to image bounds
        if (pixelX + pixelWidth > img.width) pixelWidth = Math.max(1, img.width - pixelX);
        if (pixelY + pixelHeight > img.height) pixelHeight = Math.max(1, img.height - pixelY);

        // Create canvas for this crop
        const canvas = document.createElement('canvas');
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          processedCount++;
          finalizeIfDone();
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw the cropped region
        ctx.drawImage(
          img,
          pixelX, pixelY, pixelWidth, pixelHeight,
          0, 0, pixelWidth, pixelHeight
        );

        // Expand a small margin around bbox to avoid cutting edges, then trim precisely
        // Use up to 2% of image size (max 12px) as expansion
        const expandX = Math.round(Math.min(pixelWidth * 0.04, 16));
        const expandY = Math.round(Math.min(pixelHeight * 0.04, 16));

        const expandedCanvas = document.createElement('canvas');
        expandedCanvas.width = Math.max(1, pixelWidth + expandX * 2);
        expandedCanvas.height = Math.max(1, pixelHeight + expandY * 2);
        const ectx = expandedCanvas.getContext('2d');
        if (ectx) {
          ectx.imageSmoothingEnabled = true;
          ectx.imageSmoothingQuality = 'high';
          ectx.drawImage(
            img,
            Math.max(0, pixelX - expandX),
            Math.max(0, pixelY - expandY),
            Math.min(img.width - Math.max(0, pixelX - expandX), pixelWidth + expandX * 2),
            Math.min(img.height - Math.max(0, pixelY - expandY), pixelHeight + expandY * 2),
            0,
            0,
            expandedCanvas.width,
            expandedCanvas.height
          );
        }

        // Smart trim using background flood-fill to remove frames without cutting item
        const trimmed = smartTrimCanvas(ectx ? expandedCanvas : canvas, { margin: 4, bgTolerance: 40, dilate: 3 });

        trimmed.toBlob(
          (blob) => {
            if (blob) croppedBlobs[idx] = blob;
            processedCount++;
            finalizeIfDone();
          },
          'image/png',
          1.0
        );
      });
    };

    img.onerror = () => reject(new Error('Failed to load image for bbox cropping'));
    img.src = imageUrl;
  });
};

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

          // Add inset padding to avoid edge overlaps (shrink cell by 5% on each side)
          const insetMargin = Math.max(5, Math.floor(Math.min(sw, sh) * 0.05));
          const insetCanvas = document.createElement('canvas');
          const insetW = Math.max(1, sw - insetMargin * 2);
          const insetH = Math.max(1, sh - insetMargin * 2);
          insetCanvas.width = insetW;
          insetCanvas.height = insetH;
          const insetCtx = insetCanvas.getContext('2d');
          if (insetCtx) {
            insetCtx.drawImage(cellCanvas, insetMargin, insetMargin, insetW, insetH, 0, 0, insetW, insetH);
          }

          // Smart trim to remove grid lines while preserving item edges
          const trimmed = smartTrimCanvas(insetCtx ? insetCanvas : cellCanvas, { margin: 4, bgTolerance: 38, dilate: 2 });

          trimmed.toBlob(
            (blob) => {
              if (blob) {
                croppedBlobs[itemIndex] = blob;
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
 * Find distinct item regions using connected component analysis
 */
function findItemRegions(data: Uint8ClampedArray, width: number, height: number) {
  const visited = new Array(width * height).fill(false);
  const regions = [];
  
  // More lenient threshold for non-white pixels to avoid splitting connected items
  const isNonWhite = (r: number, g: number, b: number) => {
    return r < 250 || g < 250 || b < 250;
  };
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      
      if (visited[index]) continue;
      
      const pixelIndex = index * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      
      if (!isNonWhite(r, g, b)) continue;
      
      // Found a non-white pixel, start flood fill to find the region
      const region = floodFill(data, width, height, x, y, visited, isNonWhite);
      
      // Only consider regions with significant size
      if (region.pixelCount > 500) {
        regions.push(region);
      }
    }
  }
  
  // Merge nearby regions that are likely part of the same item (e.g., full outfit)
  const mergedRegions = mergeNearbyRegions(regions, width, height);
  
  return mergedRegions;
}

/**
 * Merge regions that are vertically or horizontally close to each other
 * This helps avoid splitting full-body outfits into separate pieces
 */
function mergeNearbyRegions(regions: any[], width: number, height: number) {
  if (regions.length <= 1) return regions;
  
  const merged = [];
  const used = new Set<number>();
  
  for (let i = 0; i < regions.length; i++) {
    if (used.has(i)) continue;
    
    const region = regions[i];
    let minX = region.minX;
    let maxX = region.maxX;
    let minY = region.minY;
    let maxY = region.maxY;
    let pixelCount = region.pixelCount;
    
    // Find regions that should be merged with this one
    for (let j = i + 1; j < regions.length; j++) {
      if (used.has(j)) continue;
      
      const other = regions[j];
      
      // Check if regions are vertically aligned (same outfit, top and bottom)
      const horizontalOverlap = !(maxX < other.minX || minX > other.maxX);
      const verticalGap = Math.min(Math.abs(maxY - other.minY), Math.abs(other.maxY - minY));
      const verticalClose = verticalGap < height * 0.15; // Within 15% of image height
      
      // Check if regions are horizontally aligned (accessories, etc.)
      const verticalOverlap = !(maxY < other.minY || minY > other.maxY);
      const horizontalGap = Math.min(Math.abs(maxX - other.minX), Math.abs(other.maxX - minX));
      const horizontalClose = horizontalGap < width * 0.15; // Within 15% of image width
      
      // Merge if regions are close and aligned
      if ((horizontalOverlap && verticalClose) || (verticalOverlap && horizontalClose)) {
        minX = Math.min(minX, other.minX);
        maxX = Math.max(maxX, other.maxX);
        minY = Math.min(minY, other.minY);
        maxY = Math.max(maxY, other.maxY);
        pixelCount += other.pixelCount;
        used.add(j);
      }
    }
    
    merged.push({ minX, maxX, minY, maxY, pixelCount });
    used.add(i);
  }
  
  return merged;
}

/**
 * Flood fill algorithm to find connected regions
 */
function floodFill(
  data: Uint8ClampedArray, 
  width: number, 
  height: number, 
  startX: number, 
  startY: number, 
  visited: boolean[],
  isNonWhite: (r: number, g: number, b: number) => boolean
) {
  const stack = [{x: startX, y: startY}];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let pixelCount = 0;
  
  while (stack.length > 0) {
    const {x, y} = stack.pop()!;
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    
    const index = y * width + x;
    if (visited[index]) continue;
    
    const pixelIndex = index * 4;
    const r = data[pixelIndex];
    const g = data[pixelIndex + 1];
    const b = data[pixelIndex + 2];
    
    if (!isNonWhite(r, g, b)) continue;
    
    visited[index] = true;
    pixelCount++;
    
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    // Add neighboring pixels
    stack.push({x: x + 1, y});
    stack.push({x: x - 1, y});
    stack.push({x, y: y + 1});
    stack.push({x, y: y - 1});
  }
  
  return { minX, maxX, minY, maxY, pixelCount };
}

/** Helper: luminance (perceptual grayscale) */
function lum(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Compute a score for a region using edge density, variance and centrality */
function computeRegionScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  region: { minX: number; maxX: number; minY: number; maxY: number }
) {
  const rx0 = Math.max(0, region.minX);
  const ry0 = Math.max(0, region.minY);
  const rx1 = Math.min(width - 1, region.maxX);
  const ry1 = Math.min(height - 1, region.maxY);
  const rw = Math.max(1, rx1 - rx0 + 1);
  const rh = Math.max(1, ry1 - ry0 + 1);
  const area = rw * rh;

  // Sample grid step to keep it fast on large images
  const step = Math.max(2, Math.floor(Math.min(rw, rh) / 80));
  let samples = 0;
  let sum = 0;
  let sumSq = 0;
  let edgeSum = 0;

  for (let y = ry0 + 1; y < ry1; y += step) {
    for (let x = rx0 + 1; x < rx1; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const L = lum(r, g, b);
      sum += L;
      sumSq += L * L;
      // Simple gradient using right and bottom neighbors
      const ir = (y * width + (x + 1)) * 4;
      const ib = ((y + 1) * width + x) * 4;
      const Lr = lum(data[ir], data[ir + 1], data[ir + 2]);
      const Lb = lum(data[ib], data[ib + 1], data[ib + 2]);
      edgeSum += Math.abs(L - Lr) + Math.abs(L - Lb);
      samples++;
    }
  }
  const mean = samples ? sum / samples : 0;
  const variance = samples ? Math.max(0, sumSq / samples - mean * mean) : 0;
  const edgeDensity = samples ? edgeSum / (samples * 255) : 0; // 0..~2

  // Centrality weight (favor regions near center)
  const cx = (rx0 + rx1) / 2;
  const cy = (ry0 + ry1) / 2;
  const dx = Math.abs(cx - width / 2) / (width / 2);
  const dy = Math.abs(cy - height / 2) / (height / 2);
  const centrality = 1 - Math.min(1, Math.hypot(dx, dy));

  // Final score
  const score = Math.log(area + 1) * (0.6 + 1.2 * edgeDensity + 0.8 * (variance / 255) + 0.6 * centrality);
  return { score, edgeDensity, variance, centrality, area };
}

/**
 * Advanced smart cropping using computer vision techniques
 */
export const advancedSmartCrop = (
  compositeImageUrl: string,
  itemIndex: number,
  totalItems: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Find all non-white regions (potential items)
        const regions = findItemRegions(data, canvas.width, canvas.height);
        
        // Score regions by visual complexity and centrality to avoid picking flat background
        const scored = regions
          .map((r) => ({
            region: r,
            m: computeRegionScore(data, canvas.width, canvas.height, r),
          }))
          // Filter out tiny or very low-detail regions (e.g., flat floor/background)
          .filter((o) => o.m.area > (canvas.width * canvas.height) * 0.03 && o.m.edgeDensity > 0.03);

        if (scored.length === 0) {
          // Simple grid fallback
          const cols = Math.ceil(Math.sqrt(totalItems));
          const rows = Math.ceil(totalItems / cols);
          const cellWidth = canvas.width / cols;
          const cellHeight = canvas.height / rows;
          const col = itemIndex % cols;
          const row = Math.floor(itemIndex / cols);
          const padding = Math.min(cellWidth, cellHeight) * 0.08;
          const cropX = Math.floor(col * cellWidth + padding);
          const cropY = Math.floor(row * cellHeight + padding);
          const cropWidth = Math.floor(cellWidth - padding * 2);
          const cropHeight = Math.floor(cellHeight - padding * 2);
          const fallbackCanvas = document.createElement('canvas');
          const fctx = fallbackCanvas.getContext('2d');
          if (!fctx) { resolve(new Blob()); return; }
          fallbackCanvas.width = cropWidth;
          fallbackCanvas.height = cropHeight;
          fctx.fillStyle = '#FFFFFF';
          fctx.fillRect(0, 0, cropWidth, cropHeight);
          fctx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
          fallbackCanvas.toBlob((blob) => { if (blob) resolve(blob); else resolve(new Blob()); }, 'image/png', 1.0);
          return;
        }

        scored.sort((a, b) => b.m.score - a.m.score);
        const regionsSorted = scored.map(s => s.region);
        
        // Select the region for this item
        if (itemIndex >= regionsSorted.length) {
          // Fallback to grid division if not enough regions found
          const cols = Math.ceil(Math.sqrt(totalItems));
          const rows = Math.ceil(totalItems / cols);
          
          const cellWidth = canvas.width / cols;
          const cellHeight = canvas.height / rows;
          const col = itemIndex % cols;
          const row = Math.floor(itemIndex / cols);
          
          const padding = Math.min(cellWidth, cellHeight) * 0.1;
          const cropX = Math.floor(col * cellWidth + padding);
          const cropY = Math.floor(row * cellHeight + padding);
          const cropWidth = Math.floor(cellWidth - padding * 2);
          const cropHeight = Math.floor(cellHeight - padding * 2);
          
          const croppedCanvas = document.createElement('canvas');
          const croppedCtx = croppedCanvas.getContext('2d');
          
          if (!croppedCtx) {
            reject(new Error('Could not get cropped canvas context'));
            return;
          }
          
          croppedCanvas.width = cropWidth;
          croppedCanvas.height = cropHeight;
          
          croppedCtx.fillStyle = '#FFFFFF';
          croppedCtx.fillRect(0, 0, cropWidth, cropHeight);
          
          croppedCtx.drawImage(
            canvas,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
          );
          
          croppedCanvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create blob'));
          }, 'image/png', 1.0);
          return;
        }
        
        const region = regionsSorted[itemIndex];
        
        // Add generous padding around the detected region to avoid cutting off items
        const padding = Math.min(canvas.width, canvas.height) * 0.05; // 5% of the smaller dimension
        const cropX = Math.max(0, region.minX - padding);
        const cropY = Math.max(0, region.minY - padding);
        const cropWidth = Math.min(canvas.width - cropX, region.maxX - region.minX + padding * 2);
        const cropHeight = Math.min(canvas.height - cropY, region.maxY - region.minY + padding * 2);
        
        // Create cropped canvas
        const croppedCanvas = document.createElement('canvas');
        const croppedCtx = croppedCanvas.getContext('2d');
        
        if (!croppedCtx) {
          reject(new Error('Could not get cropped canvas context'));
          return;
        }
        
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;
        
        // Fill with white background first
        croppedCtx.fillStyle = '#FFFFFF';
        croppedCtx.fillRect(0, 0, cropWidth, cropHeight);
        
        // Draw the cropped item
        croppedCtx.drawImage(
          canvas,
          cropX, cropY, cropWidth, cropHeight,
          0, 0, cropWidth, cropHeight
        );
        
        croppedCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png', 1.0);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load composite image'));
    };
    
    img.src = compositeImageUrl;
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
      
      // Smart trim - background-aware, safer for soft shadows
      const trimmed = smartTrimCanvas(canvas, { margin: 3, bgTolerance: 44, dilate: 2 });
      
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
