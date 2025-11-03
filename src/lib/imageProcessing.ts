/**
 * Crops individual items from a composite image grid
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
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const { rows, columns, itemCount } = gridLayout;
      const cellWidth = img.width / columns;
      const cellHeight = img.height / rows;
      
      const croppedBlobs: Blob[] = [];
      let processedCount = 0;

      // Crop each cell in the grid
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const itemIndex = row * columns + col;
          
          // Stop if we've processed all items
          if (itemIndex >= itemCount) break;

          // Set canvas size to cell dimensions
          canvas.width = cellWidth;
          canvas.height = cellHeight;

          // Clear canvas
          ctx.clearRect(0, 0, cellWidth, cellHeight);

          // Draw the specific cell
          ctx.drawImage(
            img,
            col * cellWidth,  // source x
            row * cellHeight, // source y
            cellWidth,        // source width
            cellHeight,       // source height
            0,                // destination x
            0,                // destination y
            cellWidth,        // destination width
            cellHeight        // destination height
          );

          // Convert to blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                croppedBlobs.push(blob);
                processedCount++;

                // Resolve when all items are processed
                if (processedCount === itemCount) {
                  resolve(croppedBlobs);
                }
              } else {
                reject(new Error(`Failed to create blob for item ${itemIndex}`));
              }
            },
            'image/png',
            1.0
          );
        }
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load composite image'));
    };

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
