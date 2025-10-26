import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OperatorUpdate {
  id: string;
  operator: string;
  operator_code: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { updates } = await req.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return new Response(
        JSON.stringify({ success: true, updated: 0, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Backend not configured correctly');
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    let successCount = 0;
    for (const u of updates as OperatorUpdate[]) {
      if (!u?.id || !u?.operator || !u?.operator_code) continue;
      const { error } = await supabase
        .from('scraped_numbers')
        .update({ operator: u.operator, operator_code: u.operator_code })
        .eq('id', u.id);

      if (error) {
        console.error('Update error for id', u.id, error.message);
      } else {
        successCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated: successCount, total: updates.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in update-operators function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});