import { ScrapedNumber } from '@/types';

// Mock scraper for demonstration purposes
// In production, this would use Firecrawl or similar service
export async function scrapeTelguarder(
  url: string,
  onProgress?: (current: number, total: number) => void
): Promise<ScrapedNumber[]> {
  
  // Simulate scraping delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  const mockData: ScrapedNumber[] = [
    {
      id: '1',
      phoneNumber: '0270239234',
      rawNumber: '0270239234',
      category: 'Télémarketing',
      comment: 'Appel commercial insistant pour assurance',
      date: '2025-10-24 14:30'
    },
    {
      id: '2',
      phoneNumber: '0612345678',
      rawNumber: '0612345678',
      category: 'Attention',
      comment: 'Arnaque au CPF - Ne pas rappeler',
      date: '2025-10-24 10:15'
    },
    {
      id: '3',
      phoneNumber: '0142567890',
      rawNumber: '0142567890',
      category: 'Sûr',
      comment: 'Service client légitime',
      date: '2025-10-23 16:45'
    },
    {
      id: '4',
      phoneNumber: '0698765432',
      rawNumber: '0698765432',
      category: 'Télémarketing',
      comment: 'Démarchage téléphonique énergie',
      date: '2025-10-23 11:20'
    },
    {
      id: '5',
      phoneNumber: '0156789012',
      rawNumber: '0156789012',
      category: 'Attention',
      comment: 'Faux support technique Microsoft',
      date: '2025-10-22 09:30'
    },
    {
      id: '6',
      phoneNumber: '0787654321',
      rawNumber: '0787654321',
      category: 'Neutre',
      comment: 'Pas de commentaire particulier',
      date: '2025-10-22 15:10'
    },
    {
      id: '7',
      phoneNumber: '0134567890',
      rawNumber: '0134567890',
      category: 'Sûr',
      comment: 'Service après-vente officiel',
      date: '2025-10-21 13:00'
    },
    {
      id: '8',
      phoneNumber: '0623456789',
      rawNumber: '0623456789',
      category: 'Télémarketing',
      comment: 'Proposition crédit immobilier non sollicitée',
      date: '2025-10-21 10:45'
    }
  ];

  // Simulate progress updates
  for (let i = 0; i <= mockData.length; i++) {
    if (onProgress) {
      onProgress(i, mockData.length);
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return mockData;
}
