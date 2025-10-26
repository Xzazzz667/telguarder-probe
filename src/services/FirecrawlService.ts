import { supabase } from '@/integrations/supabase/client';
import { ScrapedNumber } from '@/types';

interface ScrapeResponse {
  success: boolean;
  data?: ScrapedNumber[];
  total?: number;
  offset?: number;
  limit?: number;
  error?: string;
}

export class FirecrawlService {
  static async scrapeTelguarder(
    limit: number = 1000,
    offset: number = 0,
    onProgress?: (current: number, total: number) => void
  ): Promise<ScrapedNumber[]> {
    try {
      console.log(`Calling scrape-telguarder with limit=${limit}, offset=${offset}`);
      
      // Simuler la progression
      if (onProgress) {
        const progressInterval = setInterval(() => {
          onProgress(Math.min(offset + Math.random() * limit, offset + limit), offset + limit);
        }, 500);
        
        setTimeout(() => clearInterval(progressInterval), 5000);
      }

      const { data, error } = await supabase.functions.invoke<ScrapeResponse>(
        'scrape-telguarder',
        {
          body: { limit, offset },
        }
      );

      if (error) {
        console.error('Error calling edge function:', error);
        throw new Error(error.message || 'Failed to scrape data');
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to scrape data');
      }

      console.log(`Successfully scraped ${data.data?.length || 0} numbers`);
      return data.data || [];
    } catch (error) {
      console.error('Error in scrapeTelguarder:', error);
      throw error;
    }
  }
}
