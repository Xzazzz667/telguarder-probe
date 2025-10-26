import { ScrapedNumber } from '@/types';

// Générateur de numéros de téléphone variés
function generatePhoneNumber(index: number): string {
  // Préfixes de différents opérateurs pour avoir de la variété
  const prefixes = [
    '01', '02', '03', '04', '05', // Fixes
    '06', '07' // Mobiles
  ];
  
  const prefix = prefixes[index % prefixes.length];
  const rest = String(10000000 + (index * 137) % 90000000).padStart(8, '0');
  return `0${prefix[1]}${rest}`;
}

// Mock scraper for demonstration purposes
// In production, this would use Firecrawl or similar service
export async function scrapeTelguarder(
  url: string,
  limit: number = 1000,
  offset: number = 0,
  onProgress?: (current: number, total: number) => void
): Promise<ScrapedNumber[]> {
  
  const categories = ['Télémarketing', 'Attention', 'Sûr', 'Neutre', 'Spam'];
  const comments = [
    'Appel commercial insistant pour assurance',
    'Arnaque au CPF - Ne pas rappeler',
    'Service client légitime',
    'Démarchage téléphonique énergie',
    'Faux support technique Microsoft',
    'Pas de commentaire particulier',
    'Service après-vente officiel',
    'Proposition crédit immobilier non sollicitée',
    'Appel frauduleux se faisant passer pour les impôts',
    'Spam téléphonique répété',
    'Centre d\'appels agressif',
    'Numéro fiable, société connue',
    'Tentative d\'arnaque bancaire',
    'Démarchage pour panneaux solaires',
    'Faux sondage commercial',
    'Numéro surtaxé',
    'Robot d\'appel automatique',
    'Service client réactif et professionnel',
    'Harcèlement téléphonique',
    'Appel légitime d\'une administration'
  ];

  const mockData: ScrapedNumber[] = [];
  
  // Générer les données
  for (let i = 0; i < limit; i++) {
    const index = offset + i;
    const categoryIndex = index % categories.length;
    const commentIndex = index % comments.length;
    
    // Calculer une date aléatoire dans les 30 derniers jours
    const daysAgo = Math.floor(index / 30) % 30;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().slice(0, 16).replace('T', ' ');
    
    const phoneNumber = generatePhoneNumber(index);
    
    mockData.push({
      id: String(index + 1),
      phoneNumber,
      rawNumber: phoneNumber,
      category: categories[categoryIndex],
      comment: comments[commentIndex],
      date: dateStr
    });
  }

  // Simuler le scraping progressif avec mise à jour de la progression
  const batchSize = 50;
  for (let i = 0; i <= limit; i += batchSize) {
    if (onProgress) {
      onProgress(Math.min(i, limit), limit);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Dernière mise à jour pour s'assurer d'afficher 100%
  if (onProgress) {
    onProgress(limit, limit);
  }

  return mockData;
}
