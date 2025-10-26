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
  const PER_SOURCE_LIMIT = 100;
  
  // Pattern pour les numéros français - on crée des instances séparées pour éviter les problèmes de state
  const phonePattern = /(?<!\d)(?:\+?33|0033)\s*[1-9](?:[\s\u00A0\u2009\u202F.\-]?\d{2}){4}(?!\d)|(?<!\d)0[1-9](?:[\s\u00A0\u2009\u202F.\-]?\d{2}){4}(?!\d)|(?<!\d)0[1-9]\d{8}(?!\d)/;

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

  // Patterns de date par source - plus permissifs pour capturer les numéros récents
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const [year, month, day] = today.split('-');
  
  // Version sans zéro pour le jour/mois si nécessaire
  const dayNum = parseInt(day, 10).toString();
  const monthNum = parseInt(month, 10).toString();
  
  const datePatterns: Record<string, RegExp[]> = {
    'telguarder': [
      new RegExp(`${year}\\.${month}\\.${day}`),
      new RegExp(`${year}\\.${monthNum}\\.${dayNum}`)
    ],
    'tellows': [
      new RegExp(`${day}/${month}/${year}`),
      new RegExp(`${dayNum}/${monthNum}/${year}`),
      /aujourd'hui/i,
      /il y a \d+ (heure|minute)/i
    ],
    'slickly': [
      new RegExp(`${year}-${month}-${day}`),
      new RegExp(`${dayNum}/${monthNum}/${year}`),
      new RegExp(`${day}/${month}/${year}`),
      /aujourd'hui/i,
      /il y a \d+ (heure|minute)/i
    ],
    'numeroinconnu': [
      new RegExp(`${day}/${month}/${year}`),
      new RegExp(`${dayNum}/${monthNum}/${year}`),
      /aujourd'hui/i,
      /il y a \d+ (heure|minute)/i,
      /à l'instant/i
    ],
    'callfilter': [
      /il y a \d+ (heure|minute)s?/i,
      /aujourd'hui/i,
      /à l'instant/i,
      new RegExp(`${day}/${month}/${year}`),
      new RegExp(`${dayNum}/${monthNum}/${year}`)
    ]
  };

  try {
    const firecrawl = new FirecrawlApp({ apiKey });
    
    // Scraper uniquement la première page
    console.log(`Starting scrape for ${source} (first page only)...`);
    
    const scrapeResult = await firecrawl.scrapeUrl(url, {
      formats: ['markdown', 'html'],
    });

    if (!scrapeResult.success) {
      console.error(`Failed to scrape ${url}`);
      return [];
    }

    const html = scrapeResult.html || '';
    const markdown = scrapeResult.markdown || '';
    const rawContent = (html + '\n' + markdown);
    console.log(`Scraped ${source}, content length: ${html.length + markdown.length}`);
    
    const patterns = datePatterns[source] || [];
    const isLenientSource = ['slickly', 'numeroinconnu', 'callfilter'].includes(source);

    let contentForExtraction = '';
    if (isLenientSource) {
      // Pour ces sources, on ne filtre pas par date: on extrait sur tout le contenu
      contentForExtraction = rawContent;
    } else {
      // Extraire uniquement les lignes contenant la date du jour
      const lines = rawContent.split('\n');
      const todayLines: string[] = [];
      for (const line of lines) {
        const hasDate = patterns.some(pattern => pattern.test(line));
        if (hasDate) todayLines.push(line);
      }
      console.log(`Found ${todayLines.length} lines with today's date in ${source}`);
      contentForExtraction = todayLines.join('\n');
    }
    
    // Extraire aussi les liens tel: qui contiennent souvent les numéros malgré le HTML fragmenté
    const telHrefRegex = /href\s*=\s*["']tel:([^"']+)["']/gi;
    const telHrefMatches = [...rawContent.matchAll(telHrefRegex)];
    console.log(`Found ${telHrefMatches.length} tel: links in ${source}`);

    // Regex globale pour l'extraction texte
    const phoneRegexGlobal = new RegExp(phonePattern, 'g');
    const textMatches = [...contentForExtraction.matchAll(phoneRegexGlobal)];
    console.log(`Found ${textMatches.length} text phone matches in ${source}`);

    // Fusionner les candidats depuis le texte et les liens tel:
    const candidates: string[] = [
      ...textMatches.map((m) => m[0]),
      ...telHrefMatches.map((m) => m[1]),
    ];

    console.log(`Total candidate numbers before normalization: ${candidates.length}`);

    for (const rawNumber of candidates) {
      const normalized = normalizeFrenchNumber(rawNumber);
      if (!normalized) continue;

      if (!seenNumbers.has(normalized)) {
        seenNumbers.add(normalized);

        // Déterminer la catégorie selon la source
        let category = 'Spam signalé';
        if (source === 'telguarder') category = 'Télémarketing';
        else if (source === 'tellows') category = 'Spam signalé';
        else if (source === 'slickly') category = 'Appel indésirable';
        else if (source === 'numeroinconnu') category = 'Numéro inconnu';
        else if (source === 'callfilter') category = 'Spam détecté';

        allNumbers.push({
          id: `${source}-${allNumbers.length + 1}`,
          phoneNumber: normalized,
          rawNumber,
          category,
          comment: `Crawled from ${url}`,
          date: today,
        });

        if (allNumbers.length >= PER_SOURCE_LIMIT) {
          console.log(`Reached per-source limit (${PER_SOURCE_LIMIT}) for ${source}`);
          break;
        }
      }
    }
    
    console.log(`Found ${allNumbers.length} unique phone numbers from today on ${source}`);
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
    
    // Retourner tous les nouveaux numéros (pas de pagination côté serveur)
    // Le client rechargera toutes les données depuis la base de toute façon
    console.log(`Returning ${newNumbers.length} scraped numbers`);

    return new Response(
      JSON.stringify({
        success: true,
        data: newNumbers,
        total: allNumbers.length,
        new_count: newNumbers.length,
        existing_count: existingSet.size,
        auto_scrape: auto_scrape || false,
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
