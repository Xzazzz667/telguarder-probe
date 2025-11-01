import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import FirecrawlApp from 'https://esm.sh/@mendable/firecrawl-js@1.7.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapedNumber {
  id: string;
  phone_number: string;
  signalements?: number | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const firecrawl = firecrawlApiKey ? new FirecrawlApp({ apiKey: firecrawlApiKey }) : null;

    console.log('Starting Orange reports fetch...');

    // Préfixes NPV à traiter
    const npvPrefixes = ['33162', '33270', '33377', '33424', '33568', '33948'];

    // Récupérer les numéros sans signalements (NULL)
    const { data: numbers, error: fetchError } = await supabase
      .from('scraped_numbers')
      .select('id, phone_number, signalements')
      .is('signalements', null)
      .order('created_at', { ascending: false })
      .limit(100); // Limiter pour éviter de surcharger

    if (fetchError) {
      console.error('Error fetching numbers:', fetchError);
      throw fetchError;
    }

    if (!numbers || numbers.length === 0) {
      console.log('No numbers to process');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No numbers to process',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${numbers.length} numbers...`);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Traiter chaque numéro avec un délai de 60 secondes entre chaque requête
    for (const number of numbers) {
      try {
        // Normaliser le numéro pour Orange (format international sans +)
        let phoneForOrange = number.phone_number;
        if (phoneForOrange.startsWith('0')) {
          phoneForOrange = '33' + phoneForOrange.slice(1);
        } else if (phoneForOrange.startsWith('+33')) {
          phoneForOrange = phoneForOrange.slice(1);
        } else if (!phoneForOrange.startsWith('33')) {
          phoneForOrange = '33' + phoneForOrange;
        }

        // Vérifier si le numéro est un NPV (commence par un préfixe NPV)
        const isNPV = npvPrefixes.some(prefix => phoneForOrange.startsWith(prefix));
        
        if (!isNPV) {
          console.log(`Skipping non-NPV number ${phoneForOrange}`);
          skippedCount++;
          processedCount++;
          continue;
        }

        const orangeUrl = `https://antispam.orange-telephone.com/fr/antispam/+${phoneForOrange}`;
        console.log(`Fetching Orange data for ${phoneForOrange}...`);

        let html: string | null = null;
        
        // Essayer d'abord avec fetch direct
        try {
          const response = await fetch(orangeUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });

          if (response.ok) {
            html = await response.text();
            console.log(`Successfully fetched with direct fetch for ${phoneForOrange}`);
          }
        } catch (fetchError) {
          console.warn(`Direct fetch failed for ${phoneForOrange}:`, fetchError);
        }
        
        // Si fetch échoue, essayer avec Firecrawl
        if (!html && firecrawl) {
          try {
            console.log(`Trying with Firecrawl for ${phoneForOrange}...`);
            const scrapeResult = await firecrawl.scrapeUrl(orangeUrl, {
              formats: ['html'],
            });
            
            if (scrapeResult.success && scrapeResult.html) {
              html = scrapeResult.html;
              console.log(`Successfully fetched with Firecrawl for ${phoneForOrange}`);
            }
          } catch (firecrawlError) {
            console.error(`Firecrawl also failed for ${phoneForOrange}:`, firecrawlError);
          }
        }
        
        // Si les deux méthodes ont échoué
        if (!html) {
          console.warn(`Failed to fetch Orange data for ${phoneForOrange} with all methods`);
          failedCount++;
          
          // Attendre 60 secondes avant la prochaine requête
          if (processedCount < numbers.length) {
            await new Promise(resolve => setTimeout(resolve, 60000));
          }
          continue;
        }
        
        // Extraire le nombre de signalements avec plusieurs patterns
        let signalements = 0;
        
        // Essayer plusieurs patterns regex
        const patterns = [
          /signalements?\s*[=:]\s*(\d+)/i,
          /signalements?\s*(?:&nbsp;)*[=:]\s*(?:&nbsp;)*(\d+)/i,
          /signalements?\s*(?:&nbsp;|&#160;)*[=:]\s*(?:&nbsp;|&#160;)*(\d+)/i,
          /<[^>]*signalements?[^>]*>\s*[=:]\s*(\d+)/i,
          /signalements?[^\d]*(\d{1,5})/i,
        ];
        
        let matchFound = false;
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            const value = parseInt(match[1], 10);
            // Vérifier que c'est un nombre raisonnable (pas un ID ou autre)
            if (value >= 0 && value < 1000000) {
              signalements = value;
              matchFound = true;
              console.log(`Found ${signalements} reports for ${phoneForOrange} using pattern: ${pattern}`);
              break;
            }
          }
        }
        
        if (!matchFound) {
          console.log(`No reports found for ${phoneForOrange}, setting to 0`);
          // Log un extrait du HTML pour debug
          const htmlSnippet = html.substring(0, 1000);
          console.log(`HTML snippet: ${htmlSnippet}`);
        }

        // Mettre à jour la base de données
        const { error: updateError } = await supabase
          .from('scraped_numbers')
          .update({ signalements })
          .eq('id', number.id);

        if (updateError) {
          console.error(`Error updating number ${number.id}:`, updateError);
          failedCount++;
        } else {
          successCount++;
          console.log(`Successfully updated ${phoneForOrange} with ${signalements} reports`);
        }

      } catch (error) {
        console.error(`Error processing number ${number.phone_number}:`, error);
        failedCount++;
      }

      processedCount++;

      // Attendre 60 secondes avant la prochaine requête (sauf pour le dernier)
      if (processedCount < numbers.length) {
        console.log(`Waiting 60 seconds before next request... (${processedCount}/${numbers.length})`);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    console.log(`Completed: ${successCount} successful, ${failedCount} failed, ${skippedCount} skipped (non-NPV)`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        successful: successCount,
        failed: failedCount,
        skipped: skippedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-orange-reports:', error);
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
