import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Verifies JWT token and returns authenticated user
 * @returns User object if authenticated, null otherwise
 */
export async function verifyAuth(req: Request): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return { user: null, error: 'Unauthorized' };
  }

  return { user };
}

/**
 * Returns a 401 Unauthorized response with CORS headers
 */
export function unauthorizedResponse(corsHeaders: Record<string, string>, message = 'Unauthorized') {
  return new Response(
    JSON.stringify({ error: message }), 
    {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
