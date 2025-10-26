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

async function crawlWithFirecrawl(url: string, apiKey: string, source: string, targetCount: number): Promise<ScrapedNumber[]> {
  console.log(`Crawling ${url} with Firecrawl (target: ${targetCount} numbers)...`);
  
  try {
    const firecrawl = new FirecrawlApp({ apiKey });
    
    // Utiliser crawlUrl pour parcourir plusieurs pages
    const crawlResult = await firecrawl.crawlUrl(url, {
      limit: 50, // Crawler jusqu'à 50 pages
      scrapeOptions: {
        formats: ['markdown', 'html'],
      },
    });

    if (!crawlResult.success) {
      console.error(`Failed to crawl ${url}`);
      return [];
    }

    const numbers: ScrapedNumber[] = [];
    const seenNumbers = new Set<string>();
    
    // Regex pour trouver les numéros de téléphone français
    const phoneRegex = /0[1-9](?:\s?\d{2}){4}|0[1-9]\d{8}/g;
    
    // Parcourir toutes les pages crawlées
    const pages = crawlResult.data || [];
    console.log(`Crawled ${pages.length} pages from ${source}`);
    
    for (const page of pages) {
      const html = page.html || '';
      const matches = html.match(phoneRegex) || [];
      
      for (const rawNumber of matches) {
        const cleanNumber = rawNumber.replace(/\s/g, '');
        
        // Éviter les doublons
        if (!seenNumbers.has(cleanNumber)) {
          seenNumbers.add(cleanNumber);
          
          numbers.push({
            id: `${source}-${numbers.length + 1}`,
            phoneNumber: cleanNumber,
            rawNumber: rawNumber,
            category: source === 'telguarder' ? 'Télémarketing' : 'Spam signalé',
            comment: `Crawled from ${page.url || url}`,
            date: new Date().toISOString().split('T')[0],
          });
          
          // Arrêter si on a atteint le nombre cible
          if (numbers.length >= targetCount) {
            break;
          }
        }
      }
      
      if (numbers.length >= targetCount) {
        break;
      }
    }
    
    console.log(`Found ${numbers.length} unique phone numbers on ${source}`);
    return numbers;
  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
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

    // Crawler les deux sites en parallèle pour obtenir plus de numéros
    const targetPerSite = Math.ceil(limit / 2); // Répartir l'objectif entre les deux sites
    const [telguarderNumbers, tellowsNumbers] = await Promise.all([
      crawlWithFirecrawl('https://www.telguarder.com/fr', firecrawlApiKey, 'telguarder', targetPerSite),
      crawlWithFirecrawl('https://www.tellows.fr/stats', firecrawlApiKey, 'tellows', targetPerSite),
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
