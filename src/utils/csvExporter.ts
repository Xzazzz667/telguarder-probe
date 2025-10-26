import { ScrapedNumber } from '@/types';

export function exportToCSV(data: ScrapedNumber[], filename?: string) {
  // Create CSV header
  const headers = ['Numéro', 'Opérateur', 'Catégorie', 'Commentaire', 'Date'];
  
  // Create CSV rows
  const rows = data.map(item => [
    item.phoneNumber,
    item.operator || 'Inconnu',
    item.category,
    `"${item.comment.replace(/"/g, '""')}"`, // Escape quotes in comments
    item.date
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n');

  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/(\d{8})(\d{4})/, '$1_$2');
  const finalFilename = filename || `telguarder_export_${timestamp}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', finalFilename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
