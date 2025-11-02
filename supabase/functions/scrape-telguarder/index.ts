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
  const PER_SOURCE_LIMIT = 999999;
  
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

  const stripTags = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

  // Extract comment from content based on patterns like [[text]]
  const extractComment = (content: string, source: string): string => {
    // Primary: Look for text within double brackets [[...]]
    const bracketMatch = content.match(/\[\[([^\]]+)\]\]/);
    if (bracketMatch) {
      return bracketMatch[1].trim();
    }

    // Source-specific extraction patterns
    if (source === 'telguarder') {
      // Pattern: "Ennuyeux" or category followed by comment, then "Commentaire de l'utilisateur"
      const patterns = [
        /(?:Ennuyeux|Attention|Sûr|Télémarketing)\s+([^\n]{10,200}?)\s+Commentaire de l'utilisateur/is,
        /(?:Ennuyeux|Attention|Sûr|Télémarketing)\s+([^\n]{10,200}?)$/is
      ];
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) return stripTags(match[1]).trim().slice(0, 200);
      }
    }

    if (source === 'callfilter') {
      // Pattern: "rapporté par Anonyme" followed by comment text, may include "(appel automatisé)"
      const patterns = [
        /rapporté par [^\n]+\s+([^\n]{5,300}?)\s+(?:Obtenez|il y a \d+)/is,
        /télémarketing rapporté[^\n]*\n\s*([^\n]+)/is
      ];
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) return stripTags(match[1]).trim().slice(0, 200);
      }
    }

    if (source === 'numeroinconnu') {
      // Pattern: After "Google Play" header, look for substantive comment text
      const patterns = [
        /Google Play.*?\n\s*([^\n]{15,400}?)(?:\n|Signaler)/is,
        /Commentaires relatifs.*?\n[^\n]*\n\s*([^\n]{15,400})/is
      ];
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          const text = stripTags(match[1]).trim();
          // Skip if it's just navigation text
          if (!text.match(/^(Google Play|Astuce|Télécharger)/)) {
            return text.slice(0, 200);
          }
        }
      }
    }

    if (source === 'slickly') {
      // Pattern: Phone number, date, then comment on next line
      const patterns = [
        /\d{10}\s*\d{4}-\d{2}-\d{2}\s+([^\n]{10,300}?)(?:\n|\d{10})/is,
        /\d{2}\s\d{2}\s\d{2}\s\d{2}\s\d{2}\s*\d{4}-\d{2}-\d{2}\s+([^\n]{10,300})/is
      ];
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) return stripTags(match[1]).trim().slice(0, 200);
      }
    }

    return '';
  };

  const parseDateFromContent = (content: string, fallback: string): string => {
    // dd/mm/yyyy
    const dmy = content.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) {
      const d = dmy[1].padStart(2, '0');
      const m = dmy[2].padStart(2, '0');
      const y = dmy[3];
      return `${y}-${m}-${d}`;
    }
    // yyyy-mm-dd
    const ymd = content.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) {
      const y = ymd[1];
      const m = ymd[2].padStart(2, '0');
      const d = ymd[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // aujourd'hui / il y a X minutes|heures => aujourd'hui
    if (/aujourd'hui|à l'instant|il y a \d+\s*(minute|heure)s?/i.test(content)) {
      return fallback;
    }
    return fallback;
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

    // 1) Ajouter les numéros directement trouvés sur la page principale
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

        // Try to extract comment from the main page content
        const comment = extractComment(rawContent, source) || '';

        allNumbers.push({
          id: `${source}-${allNumbers.length + 1}`,
          phoneNumber: normalized,
          rawNumber,
          category,
          comment,
          date: today,
        });

        if (allNumbers.length >= PER_SOURCE_LIMIT) {
          console.log(`Reached per-source limit (${PER_SOURCE_LIMIT}) for ${source}`);
          break;
        }
      }
    }

    // 2) POUR slickly & callfilter: suivre les liens de détail (le numéro est cliquable) pour récupérer commentaire + date
    if ((source === 'slickly' || source === 'callfilter') && allNumbers.length < PER_SOURCE_LIMIT) {
      const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
      const detailLinksSet = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = anchorRegex.exec(html))) {
        const href = match[1];
        const inner = stripTags(match[2] || '');
        if (new RegExp(phonePattern).test(inner)) {
          try {
            const abs = new URL(href, url).toString();
            detailLinksSet.add(abs);
          } catch (_) { /* ignore bad URLs */ }
        }
      }

      const detailLinks = Array.from(detailLinksSet).slice(0, 15);
      console.log(`Found ${detailLinks.length} detail links on ${source}`);

      for (const link of detailLinks) {
        if (allNumbers.length >= PER_SOURCE_LIMIT) break;
        try {
          const detail = await firecrawl.scrapeUrl(link, { formats: ['markdown','html'] });
          if (!detail.success) continue;
          const dhtml = detail.html || '';
          const dmd = detail.markdown || '';
          const dcontent = dhtml + '\n' + dmd;

          const detailPhones = [...dcontent.matchAll(phoneRegexGlobal)];
          for (const m of detailPhones) {
            const raw = m[0];
            const normalized = normalizeFrenchNumber(raw);
            if (!normalized) continue;
            if (seenNumbers.has(normalized)) continue;

            let category = source === 'callfilter' ? 'Spam détecté' : 'Appel indésirable';
            // Extract comment using the new function
            const comment = extractComment(dcontent, source) || '';
            const date = parseDateFromContent(dcontent, today);

            allNumbers.push({
              id: `${source}-${allNumbers.length + 1}`,
              phoneNumber: normalized,
              rawNumber: raw,
              category,
              comment,
              date,
            });

            seenNumbers.add(normalized);
            if (allNumbers.length >= PER_SOURCE_LIMIT) break;
          }
        } catch (e) {
          console.warn(`Failed to fetch detail ${link}:`, e);
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

    // Configuration des sources avec codes courts et limites
    const sources = [
      { name: 'telguarder', code: 'TELG', url: 'https://www.telguarder.com/fr', maxNumbers: 999999 },
      { name: 'tellows', code: 'TELW', url: 'https://www.tellows.fr/', maxNumbers: 999999 },
      { name: 'slickly', code: 'SLIK', url: 'https://slick.ly/fr/', maxNumbers: 999999 },
      { name: 'numeroinconnu', code: 'NUMI', url: 'https://www.numeroinconnu.fr/', maxNumbers: 999999 },
      { name: 'callfilter', code: 'CALF', url: 'https://callfilter.app/', maxNumbers: 999999 },
    ];

    // Crawler les cinq sites en parallèle avec timeout par site
    const telguarderP = crawlWithFirecrawl(sources[0].url, firecrawlApiKey, sources[0].name);
    const tellowsP = crawlWithFirecrawl(sources[1].url, firecrawlApiKey, sources[1].name);
    const slicklyP = crawlWithFirecrawl(sources[2].url, firecrawlApiKey, sources[2].name);
    const numeroInconnuP = crawlWithFirecrawl(sources[3].url, firecrawlApiKey, sources[3].name);
    const callfilterP = crawlWithFirecrawl(sources[4].url, firecrawlApiKey, sources[4].name);

    // Timeout util - retourne une liste vide si le site prend trop de temps
    const timeout = (ms: number) => new Promise<ScrapedNumber[]>((resolve) => setTimeout(() => resolve([]), ms));

    const [telguarderNumbers, tellowsNumbers, slicklyNumbers, numeroInconnuNumbers, callfilterNumbers] = await Promise.all([
      Promise.race([telguarderP, timeout(25000)]),
      Promise.race([tellowsP, timeout(25000)]),
      Promise.race([slicklyP, timeout(25000)]),
      Promise.race([numeroInconnuP, timeout(25000)]),
      Promise.race([callfilterP, timeout(25000)]),
    ]);
    
    // Limiter chaque source à maxNumbers et ajouter les codes sources
    const limitedTelguarder = telguarderNumbers.slice(0, sources[0].maxNumbers).map(n => ({ ...n, sourceCode: sources[0].code }));
    const limitedTellows = tellowsNumbers.slice(0, sources[1].maxNumbers).map(n => ({ ...n, sourceCode: sources[1].code }));
    const limitedSlickly = slicklyNumbers.slice(0, sources[2].maxNumbers).map(n => ({ ...n, sourceCode: sources[2].code }));
    const limitedNumeroInconnu = numeroInconnuNumbers.slice(0, sources[3].maxNumbers).map(n => ({ ...n, sourceCode: sources[3].code }));
    const limitedCallfilter = callfilterNumbers.slice(0, sources[4].maxNumbers).map(n => ({ ...n, sourceCode: sources[4].code }));
    
    console.log(`Limited results: TELG=${limitedTelguarder.length}, TELW=${limitedTellows.length}, SLIK=${limitedSlickly.length}, NUMI=${limitedNumeroInconnu.length}, CALF=${limitedCallfilter.length}`);
    
    // Combiner les résultats
    const allNumbers = [...limitedTelguarder, ...limitedTellows, ...limitedSlickly, ...limitedNumeroInconnu, ...limitedCallfilter];

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
    
    // Vérifier les numéros existants en base (par couple téléphone+source+date)
    const phones = allNumbers.map(n => n.phoneNumber);
    const { data: existingRows, error: existingErr } = await supabase
      .from('scraped_numbers')
      .select('phone_number, source, date')
      .in('phone_number', phones);

    if (existingErr) {
      console.warn('Error checking existing numbers (continuing anyway):', existingErr);
    }

    const existingKeySet = new Set(
      (existingRows || []).map(r => `${r.phone_number}|${r.source}|${r.date}`)
    );

    const newNumbers = allNumbers.filter(n => {
      const src = (n as any).sourceCode || n.id.split('-')[0];
      const key = `${n.phoneNumber}|${src}|${n.date}`;
      return !existingKeySet.has(key);
    });

    console.log(`New rows to save: ${newNumbers.length}, Existing rows (same phone+source+date): ${existingKeySet.size}`);
    
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
            source: (n as any).sourceCode || n.id.split('-')[0],
            date: n.date,
          }))
        );
      
      if (insertError) {
        console.error('Error inserting numbers:', insertError);
      } else {
        console.log(`Successfully saved ${newNumbers.length} new rows to database`);
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
        existing_count: existingKeySet.size,
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
