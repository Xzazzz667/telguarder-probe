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
  
  const allNumbers: ScrapedNumber[] = [];
  const seenNumbers = new Set<string>();
  const phoneRegex = /0[1-9](?:\s?\d{2}){4}|0[1-9]\d{8}/g;
  const maxRounds = 20; // Maximum 20 crawls de 50 pages = 1000 pages max
  let round = 0;

  try {
    const firecrawl = new FirecrawlApp({ apiKey });
    
    // Faire plusieurs crawls successifs jusqu'à atteindre le nombre cible
    while (allNumbers.length < targetCount && round < maxRounds) {
      round++;
      console.log(`Round ${round} for ${source}, current: ${allNumbers.length}/${targetCount}`);
      
      const crawlResult = await firecrawl.crawlUrl(url, {
        limit: 50, // Limite Firecrawl par crawl
        scrapeOptions: {
          formats: ['markdown', 'html'],
        },
      });

      if (!crawlResult.success) {
        console.error(`Failed to crawl ${url} on round ${round}`);
        break;
      }

      const pages = crawlResult.data || [];
      console.log(`Crawled ${pages.length} pages from ${source} (round ${round})`);
      
      let numbersFoundThisRound = 0;
      
      for (const page of pages) {
        const html = page.html || '';
        const matches = html.match(phoneRegex) || [];
        
        for (const rawNumber of matches) {
          const cleanNumber = rawNumber.replace(/\s/g, '');
          
          if (!seenNumbers.has(cleanNumber)) {
            seenNumbers.add(cleanNumber);
            numbersFoundThisRound++;
            
            allNumbers.push({
              id: `${source}-${allNumbers.length + 1}`,
              phoneNumber: cleanNumber,
              rawNumber: rawNumber,
              category: source === 'telguarder' ? 'Télémarketing' : 'Spam signalé',
              comment: `Crawled from ${page.url || url}`,
              date: new Date().toISOString().split('T')[0],
            });
            
            if (allNumbers.length >= targetCount) {
              break;
            }
          }
        }
        
        if (allNumbers.length >= targetCount) {
          break;
        }
      }
      
      console.log(`Round ${round} complete: +${numbersFoundThisRound} numbers, total: ${allNumbers.length}`);
      
      // Si on n'a trouvé aucun nouveau numéro, arrêter
      if (numbersFoundThisRound === 0) {
        console.log(`No new numbers found on round ${round}, stopping`);
        break;
      }
    }
    
    console.log(`Found ${allNumbers.length} unique phone numbers on ${source} after ${round} rounds`);
    return allNumbers;
  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
    return allNumbers; // Retourner ce qu'on a déjà collecté
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
