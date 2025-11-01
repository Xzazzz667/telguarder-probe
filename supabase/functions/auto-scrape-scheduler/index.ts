import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting automatic scraping routine...');

    // Étape 1: Scraper TelGuarder
    console.log('Step 1: Scraping TelGuarder...');
    const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke(
      'scrape-telguarder',
      {
        body: { limit: 1000, offset: 0 },
      }
    );

    if (scrapeError) {
      console.error('Error during TelGuarder scraping:', scrapeError);
      throw scrapeError;
    }

    const scrapedCount = scrapeData?.data?.length || 0;
    console.log(`Successfully scraped ${scrapedCount} numbers from TelGuarder`);

    // Étape 2: Attendre 2 minutes pour que les données soient bien insérées
    console.log('Waiting 2 minutes before starting Orange scraping...');
    await new Promise(resolve => setTimeout(resolve, 120000));

    // Étape 3: Lancer le scraping Orange pour les nouveaux numéros NPV
    console.log('Step 2: Fetching Orange reports for new NPV numbers...');
    const { data: orangeData, error: orangeError } = await supabase.functions.invoke(
      'fetch-orange-reports',
      {
        body: {},
      }
    );

    if (orangeError) {
      console.error('Error during Orange scraping:', orangeError);
      // On ne throw pas l'erreur car le scraping TelGuarder a réussi
    }

    const orangeProcessed = orangeData?.processed || 0;
    const orangeSuccess = orangeData?.successful || 0;
    console.log(`Orange scraping completed: ${orangeSuccess}/${orangeProcessed} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        telguarder: {
          scraped: scrapedCount,
        },
        orange: {
          processed: orangeProcessed,
          successful: orangeSuccess,
        },
        message: 'Automatic scraping routine completed successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-scrape-scheduler:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
