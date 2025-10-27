import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 10 } = await req.json().catch(() => ({ limit: 10 }));

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Backend not configured correctly');
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all distinct sources
    const { data: sources, error: sourcesError } = await supabase
      .from('scraped_numbers')
      .select('source')
      .order('source');

    if (sourcesError) {
      throw sourcesError;
    }

    const uniqueSources = [...new Set(sources?.map(s => s.source) || [])];
    console.log(`Found ${uniqueSources.length} unique sources:`, uniqueSources);

    let totalDeleted = 0;

    // For each source, delete the last N records
    for (const source of uniqueSources) {
      // Get the IDs of the last N records for this source
      const { data: recentRecords, error: fetchError } = await supabase
        .from('scraped_numbers')
        .select('id')
        .eq('source', source)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) {
        console.error(`Error fetching records for source ${source}:`, fetchError);
        continue;
      }

      if (!recentRecords || recentRecords.length === 0) {
        console.log(`No records found for source ${source}`);
        continue;
      }

      const idsToDelete = recentRecords.map(r => r.id);
      console.log(`Deleting ${idsToDelete.length} records from source ${source}`);

      // Delete these records
      const { error: deleteError } = await supabase
        .from('scraped_numbers')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error(`Error deleting records for source ${source}:`, deleteError);
      } else {
        totalDeleted += idsToDelete.length;
        console.log(`✅ Deleted ${idsToDelete.length} records from ${source}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalDeleted,
        sources: uniqueSources.length,
        limit 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-recent-numbers function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
