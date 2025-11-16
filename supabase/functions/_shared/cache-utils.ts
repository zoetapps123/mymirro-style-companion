/**
 * cache-utils.ts
 * 
 * Role: Caching utilities for AI API responses
 * 
 * Used by: score-outfit, and other edge functions making expensive AI calls
 * Storage: ai_cache table in Supabase
 * 
 * Purpose:
 * - Reduce redundant AI API calls for identical requests
 * - Improve response times for cached results
 * - Save AI credits/costs
 * 
 * Cache Strategy:
 * - Key: SHA-256 hash of input parameters (deterministic)
 * - TTL: 1 hour (configurable via setCachedResult)
 * - Storage: ai_cache table with cache_key unique constraint
 * 
 * Functions:
 * - generateCacheKey: Creates SHA-256 hash from input object
 * - getCachedResult: Retrieves cached result if exists and not expired
 * - setCachedResult: Stores result with expiration timestamp
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generate Cache Key
 * 
 * Creates deterministic SHA-256 hash from input data.
 * Same input always produces same cache key.
 * 
 * Usage in score-outfit:
 * const cacheKey = await generateCacheKey({ 
 *   type: "outfit_score_v4",  // Version prefix for cache invalidation
 *   imageData,                // Base64 image (dominant cache factor)
 *   occasion,                 // Optional context
 *   style,
 *   vibe
 * });
 * 
 * Returns: 64-character hex string (SHA-256)
 */
export async function generateCacheKey(data: any): Promise<string> {
  const text = JSON.stringify(data);
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get Cached Result
 * 
 * Retrieves cached result if:
 * 1. Cache key exists in ai_cache table
 * 2. expires_at timestamp is in the future
 * 
 * Returns: Cached result object or null
 * 
 * Logging:
 * - "Cache hit": Result found and valid
 * - "Cache miss": No result for this key
 * - "Cache expired": Result exists but TTL exceeded
 */
export async function getCachedResult<T>(cacheKey: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('ai_cache')
      .select('result_json, expires_at')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) {
      console.log(`Cache miss for key: ${cacheKey.substring(0, 16)}...`);
      return null;
    }

    // Check if expired
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      console.log(`Cache expired for key: ${cacheKey.substring(0, 16)}...`);
      return null;
    }

    console.log(`Cache hit for key: ${cacheKey.substring(0, 16)}...`);
    return data.result_json as T;
  } catch (err) {
    console.error('Error reading cache:', err);
    return null;
  }
}

/**
 * Set Cached Result
 * 
 * Stores AI response in cache with expiration timestamp.
 * 
 * Behavior:
 * - Uses upsert with onConflict: 'cache_key'
 * - Overwrites existing cache entries with same key
 * - TTL: 1 hour (can be adjusted)
 * 
 * Storage:
 * {
 *   cache_key: string,      // SHA-256 hash
 *   result_json: any,       // Entire API response
 *   expires_at: timestamp,  // Current time + TTL
 *   created_at: timestamp   // Auto-set by DB
 * }
 */
export async function setCachedResult(cacheKey: string, result: any): Promise<void> {
  try {
    const { error } = await supabase
      .from('ai_cache')
      .upsert({
        cache_key: cacheKey,
        result_json: result,
        expires_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()
      }, {
        onConflict: 'cache_key'
      });

    if (error) {
      console.error('Error storing cache:', error);
    } else {
      console.log(`Cached result for key: ${cacheKey.substring(0, 16)}...`);
    }
  } catch (err) {
    console.error('Error writing cache:', err);
  }
}
