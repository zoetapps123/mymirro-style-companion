/**
 * Compress and resize image to reduce payload size
 * Reduces 10MB images to ~500KB while maintaining quality
 */
export async function compressImage(
  imageBuffer: ArrayBuffer,
  maxWidth: number = 1024,
  quality: number = 80
): Promise<ArrayBuffer> {
  try {
    // Use Canvas API for image compression (available in Deno)
    const blob = new Blob([imageBuffer]);
    const imageBitmap = await createImageBitmap(blob);
    
    // Calculate new dimensions maintaining aspect ratio
    let width = imageBitmap.width;
    let height = imageBitmap.height;
    
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    
    // Create canvas and draw resized image
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    
    // Convert to JPEG blob with quality setting
    const compressedBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: quality / 100
    });
    
    return await compressedBlob.arrayBuffer();
  } catch (error) {
    console.warn('Image compression failed, using original:', error);
    return imageBuffer; // Fallback to original if compression fails
  }
}
