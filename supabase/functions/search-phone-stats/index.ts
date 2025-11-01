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
    const normalizedFr = phoneNumber.replace(/^\+33/, '0').replace(/\s/g, '');
    const international = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

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

    // Scrape all sources in parallel
    const [slickly, tellows, telguarder, callfilter, numeroinconnu] = await Promise.all([
      // Slick.ly - extract from "Méfiant(X recherches" with flexible whitespace
      scrapeSite(
        `https://slick.ly/fr/numero/${international.replace('+', '')}`,
        'Slick.ly',
        /Méfiant[\s\(]*(\d+)[\s]*recherches?/i
      ),
      
      // Tellows - extract from "Recherches: X" with flexible whitespace
      scrapeSite(
        `https://www.tellows.fr/num/${normalizedFr}`,
        'Tellows',
        /Recherches?[\s:]*(\d+)/i
      ),
      
      // TelGuarder - extract from "X Nombre de recherches" with flexible whitespace
      scrapeSite(
        `https://www.telguarder.com/fr/number/${international.replace('+', '')}`,
        'TelGuarder',
        /(\d+)[\s]*Nombre[\s]+de[\s]+recherches?/i
      ),
      
      // CallFilter - extract from "Xx négatives" with flexible whitespace
      scrapeSite(
        `https://callfilter.app/numero/${normalizedFr}`,
        'CallFilter',
        /(\d+)[\s]*x[\s]*négatives?/i
      ),
      
      // NumeroInconnu - extract from "Nombre de visites : X×" with flexible whitespace
      scrapeSite(
        `https://www.numeroinconnu.fr/numero/${normalizedFr}`,
        'NumeroInconnu',
        /Nombre[\s]+de[\s]+visites?[\s:]*(\d+)[\s]*×?/i
      ),
    ]);

    results.push(
      { source: 'Slick.ly', value: slickly },
      { source: 'Tellows', value: tellows },
      { source: 'TelGuarder', value: telguarder },
      { source: 'CallFilter', value: callfilter },
      { source: 'NumeroInconnu', value: numeroinconnu }
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
