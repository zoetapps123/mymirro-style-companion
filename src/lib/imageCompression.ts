/**
 * Shared image compression utility
 * Compresses images to reduce file size before upload
 */

export interface CompressionOptions {
  maxSize?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * Compresses an image file to specified dimensions and quality
 * @param file - The image file to compress
 * @param options - Compression options (maxSize, quality, format)
 * @returns Promise resolving to compressed image as data URL
 */
export const compressImage = (
  file: File,
  options: CompressionOptions = {}
): Promise<string> => {
  const {
    maxSize = 512,
    quality = 0.8,
    format = 'image/jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    // Validate file size before processing
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`));
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          
          // Calculate new dimensions maintaining aspect ratio
          if (width > height && width > maxSize) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width / height) * maxSize;
            height = maxSize;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to specified format with quality
          const dataUrl = canvas.toDataURL(format, quality);
          
          console.log(`Image compressed: ${file.name} (${file.size} bytes → ${dataUrl.length} chars)`);
          resolve(dataUrl);
        } catch (error) {
          reject(new Error(`Failed to compress image: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Compresses multiple image files
 * @param files - Array of image files to compress
 * @param options - Compression options
 * @returns Promise resolving to array of compressed image data URLs
 */
export const compressImages = async (
  files: File[],
  options: CompressionOptions = {}
): Promise<string[]> => {
  const compressionPromises = files.map(file => compressImage(file, options));
  return Promise.all(compressionPromises);
};
