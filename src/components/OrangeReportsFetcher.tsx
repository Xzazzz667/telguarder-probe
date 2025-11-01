import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface FetchResult {
  success: boolean;
  processed: number;
  successful: number;
  failed: number;
}

interface OrangeReportsFetcherProps {
  onFetchComplete?: () => void;
}

export function OrangeReportsFetcher({ onFetchComplete }: OrangeReportsFetcherProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);

  const handleFetch = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      toast.info('Démarrage du scraping des signalements Orange...', {
        description: 'Cette opération peut prendre plusieurs minutes (1 requête/minute)',
        duration: 5000,
      });

      const { data, error } = await supabase.functions.invoke('fetch-orange-reports');

      if (error) {
        console.error('Error calling fetch-orange-reports:', error);
        toast.error('Erreur lors du scraping Orange', {
          description: error.message || 'Une erreur est survenue',
        });
        return;
      }

      if (data && data.success) {
        setResult(data);
        toast.success('Scraping Orange terminé !', {
          description: `${data.successful} numéros mis à jour, ${data.failed} échecs`,
          duration: 5000,
        });
        
        // Appeler le callback pour rafraîchir les données
        if (onFetchComplete) {
          onFetchComplete();
        }
      } else {
        toast.error('Échec du scraping Orange', {
          description: data?.error || 'Erreur inconnue',
        });
      }
    } catch (error) {
      console.error('Error in handleFetch:', error);
      toast.error('Erreur lors du scraping Orange', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border shadow-[var(--shadow-md)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Signalements Orange
        </CardTitle>
        <CardDescription>
          Récupérer les signalements depuis antispam.orange-telephone.com
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Note :</strong> Cette opération scrape les signalements Orange pour chaque numéro 
            sans données (limite: 1 requête par minute). Cela peut prendre du temps.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Scraping en cours... (1 req/min)</span>
            </div>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {result && !isLoading && (
          <div className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              Résultats du scraping
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">{result.processed}</div>
                <div className="text-xs text-muted-foreground">Traités</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">{result.successful}</div>
                <div className="text-xs text-muted-foreground">Réussis</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-destructive">{result.failed}</div>
                <div className="text-xs text-muted-foreground">Échecs</div>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleFetch}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scraping en cours...
            </>
          ) : (
            <>
              <AlertCircle className="mr-2 h-4 w-4" />
              Lancer le scraping Orange
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
