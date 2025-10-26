import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import FirecrawlApp from 'https://esm.sh/@mendable/firecrawl-js@1.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapedNumber {
  id: string;
  phoneNumber: string;
  rawNumber: string;
  category: string;
  comment: string;
  date: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 1000, offset = 0 } = await req.json();
    
    console.log(`Starting scrape with limit=${limit}, offset=${offset}`);
    
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      throw new Error('FIRECRAWL_API_KEY not configured');
    }

    const firecrawl = new FirecrawlApp({ apiKey: firecrawlApiKey });
    
    // Scraper la page principale pour récupérer les derniers numéros
    const scrapeResult = await firecrawl.scrapeUrl('https://www.telguarder.com/fr', {
      formats: ['markdown', 'html'],
    });

    if (!scrapeResult.success) {
      throw new Error('Failed to scrape Telguarder');
    }

    console.log('Scrape successful, parsing data...');
    
    // Parser le contenu HTML pour extraire les numéros
    const scrapedNumbers: ScrapedNumber[] = [];
    const html = scrapeResult.html || '';
    
    // Regex pour trouver les numéros de téléphone français
    const phoneRegex = /0[1-9](?:\s?\d{2}){4}/g;
    const matches = html.match(phoneRegex) || [];
    
    console.log(`Found ${matches.length} phone numbers`);
    
    // Simuler pagination avec offset et limit
    const paginatedMatches = matches.slice(offset, offset + limit);
    
    for (let i = 0; i < paginatedMatches.length; i++) {
      const rawNumber = paginatedMatches[i];
      const cleanNumber = rawNumber.replace(/\s/g, '');
      
      scrapedNumbers.push({
        id: `tel-${offset + i + 1}`,
        phoneNumber: cleanNumber,
        rawNumber: rawNumber,
        category: 'Télémarketing', // Catégorie par défaut
        comment: `Scraped from telguarder.com`,
        date: new Date().toISOString().split('T')[0],
      });
    }

    console.log(`Returning ${scrapedNumbers.length} scraped numbers`);

    return new Response(
      JSON.stringify({
        success: true,
        data: scrapedNumbers,
        total: matches.length,
        offset,
        limit,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in scrape-telguarder:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
