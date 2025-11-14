import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generate a consistent hash for cache keys
 */
export async function generateCacheKey(data: any): Promise<string> {
  const text = JSON.stringify(data);
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get cached result if it exists and hasn't expired
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
 * Store result in cache with 1-hour TTL
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
