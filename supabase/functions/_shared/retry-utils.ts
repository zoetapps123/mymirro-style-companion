/**
 * Centralized retry logic with exponential backoff for handling API rate limits
 */

/**
 * Retry a function with exponential backoff when rate limits are encountered
 * 
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelayMs - Initial delay in milliseconds before first retry (default: 1000)
 * @returns The result of the function call
 * @throws The last error if all retries are exhausted or if a non-retryable error occurs
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on rate limit errors
      if (error.message === 'RATE_LIMIT' && attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.log(`Rate limited. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // Don't retry other errors (PAYMENT_REQUIRED, validation errors, etc.)
      throw error;
    }
  }
  
  throw lastError;
}
