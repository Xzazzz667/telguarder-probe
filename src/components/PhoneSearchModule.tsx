import React, { useState, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PhoneStats {
  source: string;
  value: number | null;
  error?: string;
}

interface SearchResult {
  phoneNumber: string;
  results: PhoneStats[];
}

export interface PhoneSearchModuleRef {
  searchNumber: (number: string) => void;
}

export const PhoneSearchModule = React.forwardRef<PhoneSearchModuleRef>((props, ref) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  const performSearch = async (number: string) => {
    if (!number.trim()) {
      toast.error('Veuillez entrer un numéro de téléphone');
      return;
    }

    setIsLoading(true);
    setSearchResult(null);

    try {
      console.log('Searching stats for:', number);
      
      const { data, error } = await supabase.functions.invoke('search-phone-stats', {
        body: { phoneNumber: number.trim() },
      });

      if (error) {
        console.error('Error calling function:', error);
        throw new Error(error.message || 'Erreur lors de la recherche');
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Aucun résultat trouvé');
      }

      console.log('Search results:', data);
      setSearchResult(data);
      setPhoneNumber(number);
      toast.success('Recherche terminée');
    } catch (error) {
      console.error('Error searching phone stats:', error);
      toast.error('Erreur lors de la recherche des statistiques');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSearch(phoneNumber);
  };

  // Expose search method via ref
  useImperativeHandle(ref, () => ({
    searchNumber: (number: string) => {
      performSearch(number);
    },
  }));

  return (
    <div className="w-full rounded-xl border bg-card p-6 shadow-[var(--shadow-md)]">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow">
          <Search className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Recherche par Numéro</h2>
          <p className="text-sm text-muted-foreground">
            Vérifier les statistiques sur tous les sites sources
          </p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Ex: 33948203685 ou +33948203685"
            disabled={isLoading}
            className="flex-1 transition-all duration-200"
          />
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-gradient-to-r from-primary to-primary-glow"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recherche...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Rechercher
              </>
            )}
          </Button>
        </div>
      </form>

      {searchResult && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="text-sm font-medium text-foreground">
              Numéro recherché: <span className="font-mono">{searchResult.phoneNumber}</span>
            </p>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Site Source</TableHead>
                  <TableHead className="text-right font-semibold">Nombre de Recherches / Visites</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResult.results.map((stat) => {
                  const getValueColor = (value: number | null) => {
                    if (value === null) return 'text-muted-foreground';
                    if (value < 10) return 'text-green-600 dark:text-green-400';
                    if (value <= 100) return 'text-orange-600 dark:text-orange-400';
                    return 'text-red-600 dark:text-red-400';
                  };

                  return (
                    <TableRow key={stat.source}>
                      <TableCell className="font-medium">{stat.source}</TableCell>
                      <TableCell className="text-right">
                        {stat.value !== null ? (
                          <span className={`font-mono text-lg font-semibold ${getValueColor(stat.value)}`}>
                            {stat.value.toLocaleString('fr-FR')}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Non disponible</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">
              Les données sont récupérées en temps réel depuis chaque site source.
              Certaines valeurs peuvent être indisponibles si le numéro n'est pas référencé.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
