import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from auth header (may be null for unauthenticated users)
    const { data: { user } } = await supabase.auth.getUser();

    const { 
      error_type, 
      error_message, 
      error_stack, 
      context, 
      url, 
      session_id 
    } = await req.json();

    console.log('Logging error:', { error_type, error_message, user_id: user?.id });

    // Insert error log
    const { error: insertError } = await supabase
      .from('error_logs')
      .insert({
        user_id: user?.id || null,
        error_type,
        error_message,
        error_stack,
        context,
        url,
        session_id,
      });

    if (insertError) {
      console.error('Failed to insert error log:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in log-error function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
