const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PhoneStats {
  source: string;
  value: number | null;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber } = await req.json();
    
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching stats for phone number: ${phoneNumber}`);

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      throw new Error('FIRECRAWL_API_KEY not configured');
    }

    // Normalize phone number for different formats
    // Remove any spaces, plus signs, and leading zeros
    const cleanNumber = phoneNumber.replace(/[\s+]/g, '');
    
    // Determine if it starts with country code
    const startsWithCountryCode = cleanNumber.startsWith('33');
    
    // French format (0XXXXXXXXX)
    const frenchFormat = startsWithCountryCode 
      ? '0' + cleanNumber.substring(2) 
      : cleanNumber.startsWith('0') ? cleanNumber : '0' + cleanNumber;
    
    // International without + (33XXXXXXXXX)
    const internationalFormat = startsWithCountryCode 
      ? cleanNumber 
      : cleanNumber.startsWith('0') ? '33' + cleanNumber.substring(1) : '33' + cleanNumber;

    const internationalPlus = `+${internationalFormat}`;

    const results: PhoneStats[] = [];

    // Helper function to scrape a site
    async function scrapeSite(url: string, sourceName: string, extractPattern: RegExp): Promise<number | null> {
      try {
        console.log(`Scraping ${sourceName}: ${url}`);
        
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firecrawlApiKey}`,
          },
          body: JSON.stringify({
            url: url,
            formats: ['markdown', 'html'],
            timeout: 30000,
          }),
        });

        if (!scrapeResponse.ok) {
          console.error(`${sourceName} scrape failed:`, await scrapeResponse.text());
          return null;
        }

        const scrapeData = await scrapeResponse.json();
        const markdown = scrapeData?.data?.markdown || '';
        const html = scrapeData?.data?.html || '';
        
        console.log(`${sourceName} content length - markdown: ${markdown.length}, html: ${html.length}`);
        
        // Try markdown first, then HTML
        let match = markdown.match(extractPattern);
        if (!match && html) {
          match = html.match(extractPattern);
        }
        
        if (match && match[1]) {
          const value = parseInt(match[1].replace(/[\s\u00A0]/g, ''));
          console.log(`${sourceName} found value:`, value);
          return value;
        }

        // Log a sample of content for debugging
        console.log(`${sourceName} no match found. Sample content:`, markdown.substring(0, 500));
        return null;
      } catch (error) {
        console.error(`${sourceName} error:`, error);
        return null;
      }
    }
    // Helper to try multiple URLs sequentially
    async function scrapeWithFallback(urls: string[], sourceName: string, extractPattern: RegExp) {
      for (const u of urls) {
        const v = await scrapeSite(u, sourceName, extractPattern);
        if (v !== null) return v;
      }
      return null;
    }

    // Scrape all sources in parallel
    const [slickly, tellows, telguarder, callfilter, numeroinconnu, orange] = await Promise.all([
      // Slick.ly - try several URL variants
      scrapeWithFallback(
        [
          `https://slick.ly/fr/numero/${internationalFormat}`,
          `https://slick.ly/fr/numero/${internationalPlus}`,
          `https://slick.ly/fr/${internationalFormat}`
        ],
        'Slick.ly',
        /Méfiant[\s\(]*(\d+)[\s]*recherches?/i
      ),
      
      // Tellows - uses French format (0XXXXXXXXX)
      scrapeSite(
        `https://www.tellows.fr/num/${frenchFormat}`,
        'Tellows',
        /Recherches?[\s:]*(\d+)/i
      ),
      
      // TelGuarder - try with and without plus
      scrapeWithFallback(
        [
          `https://www.telguarder.com/fr/number/${internationalPlus}`,
          `https://www.telguarder.com/fr/number/${internationalFormat}`
        ],
        'TelGuarder',
        /(\d+)[\s]*Nombre[\s]+de[\s]+recherches?/i
      ),
      
      // CallFilter - CORRECTED: uses international format without numero/ prefix
      scrapeSite(
        `https://callfilter.app/${internationalFormat}`,
        'CallFilter',
        /(\d+)[\s]*x[\s]*négatives?/i
      ),
      
      // NumeroInconnu - CORRECTED regex to handle markdown table format
      scrapeSite(
        `https://www.numeroinconnu.fr/numero/${frenchFormat}`,
        'NumeroInconnu',
        /\*\*Nombre[\s]+de[\s]+visites?[\s:]*\*\*[\s|]*(\d+)/i
      ),
      
      // Orange Antispam - uses international format with +
      scrapeSite(
        `https://antispam.orange-telephone.com/fr/antispam/${internationalPlus}`,
        'Orange',
        /Signalements?[\s]*(\d+)/i
      ),
    ]);

    results.push(
      { source: 'Slick.ly', value: slickly },
      { source: 'Tellows', value: tellows },
      { source: 'TelGuarder', value: telguarder },
      { source: 'CallFilter', value: callfilter },
      { source: 'NumeroInconnu', value: numeroinconnu },
      { source: 'Orange', value: orange }
    );

    console.log('Final results:', results);

    return new Response(
      JSON.stringify({
        success: true,
        phoneNumber,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-phone-stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
