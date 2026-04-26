import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapedNumber {
  phoneNumber: string; // International format: 33XXXXXXXXX (no leading 0)
  rawNumber: string;
  category: string;
  comment: string;
  date: string;
  sourceCode: string;
}

interface SourceConfig {
  name: string;
  code: string;
  url: string;
  category: string;
  // Optional CSS-like section filter: only extract numbers from HTML chunks whose surrounding text matches this regex
  sectionRegex?: RegExp;
}

const SOURCES: SourceConfig[] = [
  {
    name: 'telguarder',
    code: 'TELG',
    url: 'https://www.telguarder.com/fr/',
    category: 'Télémarketing',
  },
  {
    name: 'slickly',
    code: 'SLIK',
    url: 'https://slick.ly/fr/',
    category: 'Appel indésirable',
  },
  {
    name: 'tellows',
    code: 'TELW',
    url: 'https://www.tellows.fr/',
    category: 'Spam signalé',
    // On veut UNIQUEMENT les numéros dans la section "Nouveaux numéros de téléphone non désirés"
    sectionRegex: /Nouveaux\s+num[ée]ros\s+de\s+t[ée]l[ée]phone\s+non\s+d[ée]sir[ée]s([\s\S]*?)(?:<\/section|<\/div\s*class="?widget|Top\s+R[ée]cents|$)/i,
  },
  {
    name: 'callfilter',
    code: 'CALF',
    url: 'https://callfilter.app/',
    category: 'Spam détecté',
    // Section "Nouveaux avis :"
    sectionRegex: /Nouveaux\s+avis\s*:?([\s\S]*?)(?:<\/section|<footer|$)/i,
  },
  {
    name: 'numeroinconnu',
    code: 'NUMI',
    url: 'https://www.numeroinconnu.fr/',
    category: 'Numéro inconnu',
    // Onglets "Dernièrement ajoutés" ET "Dernièrement recherchés"
    sectionRegex: /(Derni[èe]rement\s+ajout[ée]s|Derni[èe]rement\s+recherch[ée]s)([\s\S]*?)(?:<\/section|<footer|Commentaires\s+r[ée]cents|$)/gi,
  },
];

// Pattern pour numéros français
const PHONE_PATTERN = /(?<!\d)(?:\+?33|0033)\s*[1-9](?:[\s\u00A0\u2009\u202F.\-]?\d{2}){4}(?!\d)|(?<!\d)0[1-9](?:[\s\u00A0\u2009\u202F.\-]?\d{2}){4}(?!\d)|(?<!\d)0[1-9]\d{8}(?!\d)/g;

// Normalisation au format international "33XXXXXXXXX" (sans 0, sans +)
function normalizeFrenchNumber(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '');
  let local: string | null = null;

  if (digits.startsWith('0033')) {
    const rest = digits.slice(4);
    if (rest.length === 9) local = '0' + rest;
  } else if (digits.startsWith('33')) {
    const rest = digits.slice(2);
    if (rest.length === 9) local = '0' + rest;
  } else if (digits.startsWith('0') && digits.length === 10) {
    local = digits;
  }

  if (!local) return null;
  // Convertir en format international sans le 0
  return '33' + local.slice(1);
}

async function fetchPage(url: string): Promise<string> {
  const headers: HeadersInit = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.warn(`Fetch ${url} -> HTTP ${res.status}`);
      return '';
    }
    return await res.text();
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`Fetch ${url} failed:`, err);
    return '';
  }
}

function extractNumbersFromHtml(html: string, source: SourceConfig): ScrapedNumber[] {
  const today = new Date().toISOString().split('T')[0];
  const seen = new Set<string>(); // dedup intra-source par phone_number international
  const results: ScrapedNumber[] = [];

  // Choisir le contenu à analyser : section ciblée ou page entière
  let contentChunks: string[] = [];
  if (source.sectionRegex) {
    if (source.sectionRegex.global) {
      const matches = [...html.matchAll(source.sectionRegex)];
      for (const m of matches) {
        // Le chunk capturé peut être en groupe 1 ou 2 selon la regex
        contentChunks.push(m[2] || m[1] || '');
      }
    } else {
      const m = html.match(source.sectionRegex);
      if (m) contentChunks.push(m[1] || '');
    }
    if (contentChunks.length === 0) {
      console.log(`[${source.name}] section "${source.sectionRegex}" introuvable, fallback page entière`);
      contentChunks = [html];
    }
  } else {
    contentChunks = [html];
  }

  const combined = contentChunks.join('\n');

  // Extraction depuis le texte
  const phoneRegex = new RegExp(PHONE_PATTERN.source, 'g');
  const textMatches = [...combined.matchAll(phoneRegex)].map((m) => m[0]);

  // Extraction depuis les liens tel:
  const telHrefRegex = /href\s*=\s*["']tel:([^"']+)["']/gi;
  const telMatches = [...combined.matchAll(telHrefRegex)].map((m) => m[1]);

  const candidates = [...textMatches, ...telMatches];
  console.log(`[${source.name}] candidats: ${candidates.length} (texte=${textMatches.length}, tel=${telMatches.length})`);

  for (const raw of candidates) {
    const normalized = normalizeFrenchNumber(raw);
    if (!normalized) continue;
    if (seen.has(normalized)) continue; // dedup intra-source
    seen.add(normalized);

    results.push({
      phoneNumber: normalized,
      rawNumber: raw.trim(),
      category: source.category,
      comment: '',
      date: today,
      sourceCode: source.code,
    });
  }

  console.log(`[${source.name}] uniques après dedup: ${results.length}`);
  return results;
}

async function scrapeSource(source: SourceConfig): Promise<ScrapedNumber[]> {
  console.log(`[${source.name}] fetching ${source.url}`);
  const html = await fetchPage(source.url);
  if (!html) {
    console.warn(`[${source.name}] HTML vide`);
    return [];
  }
  console.log(`[${source.name}] HTML length: ${html.length}`);
  return extractNumbersFromHtml(html, source);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const auto_scrape = body?.auto_scrape === true;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Starting direct scrape (no Firecrawl) for ${SOURCES.length} sources, auto_scrape=${auto_scrape}`);

    // Scraper toutes les sources en parallèle
    const results = await Promise.all(SOURCES.map((s) => scrapeSource(s).catch((e) => {
      console.error(`[${s.name}] erreur:`, e);
      return [] as ScrapedNumber[];
    })));

    const allNumbers = results.flat();
    console.log(`Total scraped: ${allNumbers.length}`);

    if (allNumbers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [],
          total: 0,
          new_count: 0,
          message: 'Aucun numéro trouvé',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Dedup global (au cas où) sur (phone_number, sourceCode)
    const seenKeys = new Set<string>();
    const uniqueNumbers: ScrapedNumber[] = [];
    for (const n of allNumbers) {
      const key = `${n.phoneNumber}|${n.sourceCode}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      uniqueNumbers.push(n);
    }

    // Vérifier en base les couples (phone, source) déjà existants — on autorise les doublons inter-sources
    const phones = uniqueNumbers.map((n) => n.phoneNumber);
    const { data: existingRows, error: existingErr } = await supabase
      .from('scraped_numbers')
      .select('phone_number, source')
      .in('phone_number', phones);

    if (existingErr) {
      console.warn('Existing check error:', existingErr);
    }

    const existingKeys = new Set(
      (existingRows || []).map((r) => `${r.phone_number}|${r.source}`)
    );

    const newRows = uniqueNumbers.filter((n) => !existingKeys.has(`${n.phoneNumber}|${n.sourceCode}`));
    console.log(`New rows to insert: ${newRows.length} / total uniques: ${uniqueNumbers.length}`);

    if (newRows.length > 0) {
      const { error: insertError } = await supabase
        .from('scraped_numbers')
        .insert(
          newRows.map((n) => ({
            phone_number: n.phoneNumber,
            raw_number: n.rawNumber,
            category: n.category,
            comment: n.comment,
            operator: 'Inconnu',
            operator_code: 'UNKNOWN',
            source: n.sourceCode,
            date: n.date,
          }))
        );

      if (insertError) {
        console.error('Insert error:', insertError);
      } else {
        console.log(`Inserted ${newRows.length} new numbers`);
      }
    }

    // Stats par source
    const perSource: Record<string, number> = {};
    for (const n of newRows) {
      perSource[n.sourceCode] = (perSource[n.sourceCode] || 0) + 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: newRows,
        total: uniqueNumbers.length,
        new_count: newRows.length,
        per_source: perSource,
        auto_scrape,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-telguarder:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
