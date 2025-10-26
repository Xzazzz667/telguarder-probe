import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ScrapingFormProps {
  onScrapingComplete: (data: any[]) => void;
}

export function ScrapingForm({ onScrapingComplete }: ScrapingFormProps) {
  const [url, setUrl] = useState('https://www.telguarder.com/fr');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentCount, setCurrentCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setProgress(0);
    setCurrentCount(0);
    setTotalCount(0);

    try {
      // Import dynamically to avoid build issues
      const { scrapeTelguarder } = await import('@/utils/mockScraper');
      
      const data = await scrapeTelguarder(url, (current, total) => {
        setCurrentCount(current);
        setTotalCount(total);
        setProgress((current / total) * 100);
      });

      onScrapingComplete(data);
      toast.success(`${data.length} numéros extraits avec succès`);
    } catch (error) {
      console.error('Erreur lors du scraping:', error);
      toast.error('Erreur lors de l\'extraction des données');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full rounded-xl border bg-card p-6 shadow-[var(--shadow-md)]">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow">
          <Database className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Interface de Scraping</h2>
          <p className="text-sm text-muted-foreground">Extraire les numéros depuis TelGuarder</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="url" className="text-sm font-medium text-foreground">
            URL du site
          </label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.telguarder.com/fr"
            required
            disabled={isLoading}
            className="transition-all duration-200"
          />
        </div>

        {isLoading && (
          <div className="space-y-2 rounded-lg bg-secondary/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Extraction en cours...</span>
              <span className="font-medium text-primary">
                {currentCount} / {totalCount} numéros
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-primary to-primary-glow font-medium shadow-[var(--shadow-sm)] transition-all duration-200 hover:shadow-[var(--shadow-md)]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scraping en cours...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Scraper les numéros
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
