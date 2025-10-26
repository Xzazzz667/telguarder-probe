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

async function crawlWithFirecrawl(url: string, apiKey: string, source: string): Promise<ScrapedNumber[]> {
  console.log(`Crawling ${url} with Firecrawl...`);
  
  const allNumbers: ScrapedNumber[] = [];
  const seenNumbers = new Set<string>();
  const phoneRegex = /0[1-9](?:\s?\d{2}){4}|0[1-9]\d{8}/g;

  try {
    const firecrawl = new FirecrawlApp({ apiKey });
    
    // Un seul crawl de 50 pages pour éviter le timeout
    console.log(`Starting crawl for ${source}...`);
    
    const crawlResult = await firecrawl.crawlUrl(url, {
      limit: 50,
      scrapeOptions: {
        formats: ['markdown', 'html'],
      },
    });

    if (!crawlResult.success) {
      console.error(`Failed to crawl ${url}`);
      return [];
    }

    const pages = crawlResult.data || [];
    console.log(`Crawled ${pages.length} pages from ${source}`);
    
    for (const page of pages) {
      const html = page.html || '';
      const matches = html.match(phoneRegex) || [];
      
      for (const rawNumber of matches) {
        const cleanNumber = rawNumber.replace(/\s/g, '');
        
        if (!seenNumbers.has(cleanNumber)) {
          seenNumbers.add(cleanNumber);
          
          allNumbers.push({
            id: `${source}-${allNumbers.length + 1}`,
            phoneNumber: cleanNumber,
            rawNumber: rawNumber,
            category: source === 'telguarder' ? 'Télémarketing' : 'Spam signalé',
            comment: `Crawled from ${page.url || url}`,
            date: new Date().toISOString().split('T')[0],
          });
        }
      }
    }
    
    console.log(`Found ${allNumbers.length} unique phone numbers on ${source}`);
    return allNumbers;
  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
    return allNumbers;
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

    // Crawler les deux sites en parallèle avec timeout par site
    const telguarderP = crawlWithFirecrawl('https://www.telguarder.com/fr', firecrawlApiKey, 'telguarder');
    const tellowsP = crawlWithFirecrawl('https://www.tellows.fr/stats', firecrawlApiKey, 'tellows');

    // Timeout util - retourne une liste vide si le site prend trop de temps
    const timeout = (ms: number) => new Promise<ScrapedNumber[]>((resolve) => setTimeout(() => resolve([]), ms));

    const [telguarderNumbers, tellowsNumbers] = await Promise.all([
      Promise.race([telguarderP, timeout(25000)]),
      Promise.race([tellowsP, timeout(25000)]),
    ]);
    
    // Combiner les résultats
    const allNumbers = [...telguarderNumbers, ...tellowsNumbers];

    if (allNumbers.length === 0) {
      console.warn('No phone numbers were found on either website (timeout or site blocked)');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Aucun numéro trouvé (timeout ou blocage des sites). Réessayez ou relancez un nouveau scrap.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
