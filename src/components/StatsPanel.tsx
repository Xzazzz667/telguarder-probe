import { useMemo } from 'react';
import { ScrapedNumber } from '@/types';
import { PeriodFilter, getPeriodDates } from '@/types/filters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Users, AlertTriangle } from 'lucide-react';

interface StatsPanelProps {
  data: ScrapedNumber[];
  periodFilter: PeriodFilter;
}

export function StatsPanel({ data, periodFilter }: StatsPanelProps) {
  const stats = useMemo(() => {
    // Filtrer les données selon la période
    let filteredData = [...data];
    
    if (periodFilter !== 'all') {
      const periodDates = getPeriodDates(periodFilter);
      if (periodDates) {
        filteredData = filteredData.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= periodDates.from && itemDate <= periodDates.to;
        });
      }
    }

    const categoryCounts: Record<string, number> = {};
    const operatorCounts: Record<string, number> = {};

    filteredData.forEach(item => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      if (item.operator) {
        operatorCounts[item.operator] = (operatorCounts[item.operator] || 0) + 1;
      }
    });

    // Calculer la moyenne des signalements par opérateur
    const operatorSignalements: Record<string, { total: number; count: number }> = {};
    
    filteredData.forEach(item => {
      if (item.operator && item.signalements !== null && item.signalements !== undefined) {
        if (!operatorSignalements[item.operator]) {
          operatorSignalements[item.operator] = { total: 0, count: 0 };
        }
        operatorSignalements[item.operator].total += item.signalements;
        operatorSignalements[item.operator].count += 1;
      }
    });

    const topOperators = Object.entries(operatorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 25)
      .map(([operator, count]) => {
        const avgSignalements = operatorSignalements[operator]
          ? Math.round(operatorSignalements[operator].total / operatorSignalements[operator].count)
          : 0;
        return [operator, count, avgSignalements] as [string, number, number];
      });

    return {
      total: filteredData.length,
      categoryCounts,
      topOperators,
    };
  }, [data, periodFilter]);

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-4">
      <h2 className="text-2xl font-semibold text-foreground">Statistiques</h2>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border shadow-[var(--shadow-md)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Numéros</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Numéros extraits</p>
          </CardContent>
        </Card>

        <Card className="border shadow-[var(--shadow-md)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attention</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.categoryCounts['Attention'] || 0}
            </div>
            <p className="text-xs text-muted-foreground">Numéros suspects</p>
          </CardContent>
        </Card>

        <Card className="border shadow-[var(--shadow-md)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Télémarketing</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.categoryCounts['Télémarketing'] || 0}
            </div>
            <p className="text-xs text-muted-foreground">Appels commerciaux</p>
          </CardContent>
        </Card>

        <Card className="border shadow-[var(--shadow-md)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sûr</CardTitle>
            <Users className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.categoryCounts['Sûr'] || 0}
            </div>
            <p className="text-xs text-muted-foreground">Numéros légitimes</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Distribution */}
      <Card className="border shadow-[var(--shadow-md)]">
        <CardHeader>
          <CardTitle>Répartition par catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(stats.categoryCounts).map(([category, count]) => {
              const percentage = ((count / stats.total) * 100).toFixed(1);
              return (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{category}</span>
                    <span className="text-muted-foreground">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all ${
                        category === 'Attention'
                          ? 'bg-destructive'
                          : category === 'Télémarketing'
                          ? 'bg-orange-500'
                          : category === 'Sûr'
                          ? 'bg-accent'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Operators */}
      <Card className="border shadow-[var(--shadow-md)]">
        <CardHeader>
          <CardTitle>Top 25 Opérateurs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.topOperators.map(([operator, count, avgSignalements], index) => {
              const percentage = ((count / stats.total) * 100).toFixed(1);
              return (
                <div key={operator} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{operator}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          Moy: {avgSignalements} signalements
                        </span>
                        <span className="text-muted-foreground">
                          {count} ({percentage}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
