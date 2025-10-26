import FirecrawlApp from 'https://esm.sh/@mendable/firecrawl-js@1.10.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  // Match FR numbers in national or international form and avoid partial captures
  const phoneRegex = /(?<!\d)(?:\+?33|0033)\s*[1-9](?:[\s.\-]?\d{2}){4}(?!\d)|(?<!\d)0[1-9](?:[\s.\-]?\d{2}){4}(?!\d)|(?<!\d)0[1-9]\d{8}(?!\d)/g;

  // Normalize to French national format: 0XXXXXXXXX
  const normalizeFrenchNumber = (input: string): string | null => {
    const digits = input.replace(/[^\d]/g, '');
    if (digits.startsWith('0033')) {
      const rest = digits.slice(4);
      return rest.length === 9 ? '0' + rest : null;
    }
    if (digits.startsWith('33')) {
      const rest = digits.slice(2);
      return rest.length === 9 ? '0' + rest : null;
    }
    if (digits.startsWith('0') && digits.length === 10) return digits;
    return null;
  };

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
        const normalized = normalizeFrenchNumber(rawNumber);
        if (!normalized) continue;
        if (!seenNumbers.has(normalized)) {
          seenNumbers.add(normalized);
          allNumbers.push({
            id: `${source}-${allNumbers.length + 1}`,
            phoneNumber: normalized,
            rawNumber,
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
    const { limit = 1000, offset = 0, auto_scrape = false } = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log(`Starting scrape with limit=${limit}, offset=${offset}`);
    
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      throw new Error('FIRECRAWL_API_KEY not configured. Please add your Firecrawl API key in the backend secrets.');
    }

    // Crawler les cinq sites en parallèle avec timeout par site
    const telguarderP = crawlWithFirecrawl('https://www.telguarder.com/fr', firecrawlApiKey, 'telguarder');
    const tellowsP = crawlWithFirecrawl('https://www.tellows.fr/', firecrawlApiKey, 'tellows');
    const slicklyP = crawlWithFirecrawl('https://slick.ly/fr/', firecrawlApiKey, 'slickly');
    const numeroInconnuP = crawlWithFirecrawl('https://www.numeroinconnu.fr/', firecrawlApiKey, 'numeroinconnu');
    const callfilterP = crawlWithFirecrawl('https://callfilter.app/', firecrawlApiKey, 'callfilter');

    // Timeout util - retourne une liste vide si le site prend trop de temps
    const timeout = (ms: number) => new Promise<ScrapedNumber[]>((resolve) => setTimeout(() => resolve([]), ms));

    const [telguarderNumbers, tellowsNumbers, slicklyNumbers, numeroInconnuNumbers, callfilterNumbers] = await Promise.all([
      Promise.race([telguarderP, timeout(25000)]),
      Promise.race([tellowsP, timeout(25000)]),
      Promise.race([slicklyP, timeout(25000)]),
      Promise.race([numeroInconnuP, timeout(25000)]),
      Promise.race([callfilterP, timeout(25000)]),
    ]);
    
    // Combiner les résultats
    const allNumbers = [...telguarderNumbers, ...tellowsNumbers, ...slicklyNumbers, ...numeroInconnuNumbers, ...callfilterNumbers];

    if (allNumbers.length === 0) {
      console.warn('No phone numbers were found on either website (timeout or site blocked)');
      
      // Si c'est un auto_scrape, retourner succès quand même (pas de nouveaux numéros)
      if (auto_scrape) {
        console.log('Auto-scrape completed with no new numbers');
        return new Response(
          JSON.stringify({ success: true, data: [], total: 0, new_count: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Aucun numéro trouvé (timeout ou blocage des sites). Réessayez ou relancez un nouveau scrap.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Total numbers found: ${allNumbers.length}`);
    
    // Vérifier les numéros existants en base
    const { data: existingNumbers } = await supabase
      .from('scraped_numbers')
      .select('phone_number')
      .in('phone_number', allNumbers.map(n => n.phoneNumber));
    
    const existingSet = new Set(existingNumbers?.map(n => n.phone_number) || []);
    const newNumbers = allNumbers.filter(n => !existingSet.has(n.phoneNumber));
    
    console.log(`New numbers to save: ${newNumbers.length}, Already in DB: ${existingSet.size}`);
    
    // Enregistrer les nouveaux numéros en base
    if (newNumbers.length > 0) {
      const { error: insertError } = await supabase
        .from('scraped_numbers')
        .insert(
          newNumbers.map(n => ({
            phone_number: n.phoneNumber,
            raw_number: n.rawNumber,
            category: n.category,
            comment: n.comment,
            operator: 'Inconnu',
            operator_code: 'UNKNOWN',
            source: n.id.split('-')[0],
            date: n.date,
          }))
        );
      
      if (insertError) {
        console.error('Error inserting numbers:', insertError);
      } else {
        console.log(`Successfully saved ${newNumbers.length} new numbers to database`);
      }
    }
    
    // Si c'est un auto_scrape, retourner succès avec le nombre de nouveaux numéros
    if (auto_scrape) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: newNumbers, 
          total: allNumbers.length,
          new_count: newNumbers.length,
          existing_count: existingSet.size
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Appliquer la pagination pour les requêtes manuelles
    const paginatedNumbers = newNumbers.slice(offset, offset + limit);
    
    console.log(`Returning ${paginatedNumbers.length} scraped numbers`);

    return new Response(
      JSON.stringify({
        success: true,
        data: paginatedNumbers,
        total: newNumbers.length,
        new_count: newNumbers.length,
        existing_count: existingSet.size,
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
