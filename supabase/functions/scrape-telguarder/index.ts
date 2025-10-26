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

async function scrapeWithFirecrawl(url: string, apiKey: string, source: string): Promise<ScrapedNumber[]> {
  console.log(`Scraping ${url} with Firecrawl...`);
  
  try {
    const firecrawl = new FirecrawlApp({ apiKey });
    
    const scrapeResult = await firecrawl.scrapeUrl(url, {
      formats: ['markdown', 'html'],
      timeout: 30000,
    });

    if (!scrapeResult.success) {
      console.error(`Failed to scrape ${url}`);
      return [];
    }

    const html = scrapeResult.html || '';
    const numbers: ScrapedNumber[] = [];
    
    // Regex pour trouver les numéros de téléphone français
    const phoneRegex = /0[1-9](?:\s?\d{2}){4}|0[1-9]\d{8}/g;
    const matches = html.match(phoneRegex) || [];
    
    // Supprimer les doublons
    const uniqueNumbers = [...new Set(matches)];
    
    console.log(`Found ${uniqueNumbers.length} unique phone numbers on ${source}`);
    
    for (let i = 0; i < uniqueNumbers.length; i++) {
      const rawNumber = uniqueNumbers[i];
      const cleanNumber = rawNumber.replace(/\s/g, '');
      
      numbers.push({
        id: `${source}-${i + 1}`,
        phoneNumber: cleanNumber,
        rawNumber: rawNumber,
        category: source === 'telguarder' ? 'Télémarketing' : 'Spam signalé',
        comment: `Scraped from ${url}`,
        date: new Date().toISOString().split('T')[0],
      });
    }
    
    return numbers;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return [];
  }
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
      throw new Error('FIRECRAWL_API_KEY not configured. Please add your Firecrawl API key in the backend secrets.');
    }

    // Scraper les deux sites en parallèle
    const [telguarderNumbers, tellowsNumbers] = await Promise.all([
      scrapeWithFirecrawl('https://www.telguarder.com/fr', firecrawlApiKey, 'telguarder'),
      scrapeWithFirecrawl('https://www.tellows.fr/stats', firecrawlApiKey, 'tellows'),
    ]);
    
    // Combiner les résultats
    const allNumbers = [...telguarderNumbers, ...tellowsNumbers];
    
    if (allNumbers.length === 0) {
      console.warn('No phone numbers were found on either website');
    }
    
    console.log(`Total numbers found: ${allNumbers.length}`);
    
    // Appliquer la pagination
    const paginatedNumbers = allNumbers.slice(offset, offset + limit);
    
    console.log(`Returning ${paginatedNumbers.length} scraped numbers`);

    return new Response(
      JSON.stringify({
        success: true,
        data: paginatedNumbers,
        total: allNumbers.length,
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
