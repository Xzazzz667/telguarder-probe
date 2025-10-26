import { useState, useEffect } from 'react';
import { ScrapedNumber } from '@/types';
import { ScrapingForm } from '@/components/ScrapingForm';
import { ResultsTable } from '@/components/ResultsTable';
import { StatsPanel } from '@/components/StatsPanel';
import { operatorMatcher } from '@/utils/operatorMatcher';
import { loadOperatorRanges, loadOperatorIdentities } from '@/utils/csvLoader';
import { toast } from 'sonner';
import { Loader2, Phone } from 'lucide-react';

const Index = () => {
  const [scrapedData, setScrapedData] = useState<ScrapedNumber[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load operator data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Début du chargement des données ARCEP...');
        const [ranges, identities] = await Promise.all([
          loadOperatorRanges(),
          loadOperatorIdentities(),
        ]);
        
        console.log(`Données chargées: ${ranges.length} tranches, ${identities.length} opérateurs`);
        
        operatorMatcher.setRanges(ranges);
        operatorMatcher.setIdentities(identities);
        
        toast.success(`Données ARCEP chargées: ${ranges.length} tranches, ${identities.length} opérateurs`);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        toast.error('Erreur lors du chargement des données ARCEP');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, []);

  const handleScrapingComplete = (data: ScrapedNumber[], append: boolean = false) => {
    // Match operators for all numbers
    const matchedData = operatorMatcher.matchNumbers(data);
    
    if (append) {
      // Ajouter aux données existantes
      setScrapedData(prev => [...prev, ...matchedData]);
    } else {
      // Remplacer les données
      setScrapedData(matchedData);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement des données ARCEP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-card to-card shadow-[var(--shadow-sm)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-[var(--shadow-md)]">
              <Phone className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">TelGuarder Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Extraction et analyse des numéros de téléphone
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Scraping Form */}
          <ScrapingForm 
            onScrapingComplete={handleScrapingComplete}
            currentDataCount={scrapedData.length}
          />

          {/* Results Section */}
          {scrapedData.length > 0 && (
            <>
              <StatsPanel data={scrapedData} />
              <ResultsTable data={scrapedData} />
            </>
          )}

          {/* Empty State */}
          {scrapedData.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Phone className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                Aucune donnée disponible
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Lancez une extraction pour analyser les numéros de téléphone et découvrir leurs opérateurs
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t bg-card/50 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 TelGuarder Analytics - Outil interne d'analyse</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
