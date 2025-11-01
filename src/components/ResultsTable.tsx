import { useState, useMemo, useEffect } from 'react';
import { ScrapedNumber, FilterState } from '@/types';
import { PeriodFilter, getPeriodDates } from '@/types/filters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportToCSV } from '@/utils/csvExporter';
import { toast } from 'sonner';

interface ResultsTableProps {
  data: ScrapedNumber[];
  periodFilter: PeriodFilter;
  onPeriodFilterChange: (period: PeriodFilter) => void;
}

const ITEMS_PER_PAGE = 50;

export function ResultsTable({ data, periodFilter, onPeriodFilterChange }: ResultsTableProps) {
  const [filters, setFilters] = useState<FilterState>({
    operator: 'all',
    category: 'all',
    searchTerm: '',
    dateFrom: '',
    dateTo: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<keyof ScrapedNumber>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [periodFilter, filters]);

  // Get unique values for filters
  const operators = useMemo(() => {
    const unique = [...new Set(data.map(d => d.operator).filter(Boolean))];
    return unique.sort();
  }, [data]);

  const categories = useMemo(() => {
    const unique = [...new Set(data.map(d => d.category))];
    return unique.sort();
  }, [data]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply period filter
    if (periodFilter !== 'all') {
      const periodDates = getPeriodDates(periodFilter);
      if (periodDates) {
        result = result.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= periodDates.from && itemDate <= periodDates.to;
        });
      }
    }

    // Apply custom date range if in custom mode
    if (periodFilter === 'custom') {
      if (filters.dateFrom) {
        result = result.filter(item => item.date >= filters.dateFrom);
      }
      if (filters.dateTo) {
        result = result.filter(item => item.date <= filters.dateTo);
      }
    }

    // Apply other filters
    if (filters.operator !== 'all') {
      result = result.filter(item => item.operator === filters.operator);
    }
    if (filters.category !== 'all') {
      result = result.filter(item => item.category === filters.category);
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(
        item =>
          item.phoneNumber.includes(term) ||
          item.comment.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortColumn] || '';
      const bVal = b[sortColumn] || '';
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [data, filters, periodFilter, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (column: keyof ScrapedNumber) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleExport = () => {
    exportToCSV(filteredData);
    toast.success(`${filteredData.length} entrées exportées`);
  };

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-4">
      {/* Filters */}
      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-md)]">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Filtres et recherche</h3>
        
        {/* Période filter */}
        <div className="mb-4">
          <label className="text-sm font-medium text-foreground">Période</label>
          <Select
            value={periodFilter}
            onValueChange={(value: PeriodFilter) => onPeriodFilterChange(value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les périodes</SelectItem>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="this_week">Cette semaine</SelectItem>
              <SelectItem value="this_month">Ce mois</SelectItem>
              <SelectItem value="this_quarter">Ce trimestre</SelectItem>
              <SelectItem value="this_year">Cette année</SelectItem>
              <SelectItem value="yesterday">Hier</SelectItem>
              <SelectItem value="last_week">Semaine précédente</SelectItem>
              <SelectItem value="last_month">Mois précédent</SelectItem>
              <SelectItem value="last_quarter">Trimestre précédent</SelectItem>
              <SelectItem value="last_year">Année précédente</SelectItem>
              <SelectItem value="custom">Personnaliser</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Custom date range (shown only when custom is selected) */}
        {periodFilter === 'custom' && (
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Date de début</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Date de fin</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Recherche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Numéro ou commentaire..."
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Opérateur</label>
            <Select
              value={filters.operator}
              onValueChange={(value) => setFilters({ ...filters, operator: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les opérateurs</SelectItem>
                {operators.map(op => (
                  <SelectItem key={op} value={op!}>{op}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Catégorie</label>
            <Select
              value={filters.category}
              onValueChange={(value) => setFilters({ ...filters, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredData.length} résultat{filteredData.length > 1 ? 's' : ''}
          </p>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-[var(--shadow-md)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('phoneNumber')}
                >
                  Numéro {sortColumn === 'phoneNumber' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('operator')}
                >
                  Opérateur {sortColumn === 'operator' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('category')}
                >
                  Catégorie {sortColumn === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead>Origine</TableHead>
                <TableHead>Commentaire</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('signalements')}
                >
                  Signalements {sortColumn === 'signalements' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('date')}
                >
                  Date {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">
                    <a
                      href={`https://antispam.orange-telephone.com/fr/antispam/+${item.phoneNumber.startsWith('0') ? '33' + item.phoneNumber.slice(1) : item.phoneNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline hover:text-primary/80 transition-colors"
                    >
                      {item.phoneNumber.startsWith('0') ? '33' + item.phoneNumber.slice(1) : item.phoneNumber}
                    </a>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {item.operator || 'Inconnu'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.category === 'Attention'
                          ? 'bg-destructive/10 text-destructive'
                          : item.category === 'Télémarketing'
                          ? 'bg-orange-500/10 text-orange-600'
                          : item.category === 'Sûr'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {item.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-mono font-medium text-secondary-foreground">
                      {(item as any).source || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm">{item.comment || '-'}</TableCell>
                  <TableCell className="text-center">
                    {item.signalements !== null && item.signalements !== undefined ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.signalements > 1000 
                          ? 'bg-destructive/10 text-destructive' 
                          : item.signalements > 100
                          ? 'bg-orange-500/10 text-orange-600'
                          : 'bg-accent/10 text-accent'
                      }`}>
                        {item.signalements}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t p-4">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} sur {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
