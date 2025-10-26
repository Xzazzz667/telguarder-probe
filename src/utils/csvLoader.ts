import Papa from 'papaparse';
import { OperatorRange, OperatorIdentity } from '@/types';

export async function loadOperatorRanges(): Promise<OperatorRange[]> {
  const response = await fetch('/data/MAJNUM_2025-10-25.csv');
  const csvText = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
      complete: (results) => {
        const ranges: OperatorRange[] = results.data.map((row: any) => ({
          ezabpqm: row.EZABPQM || '',
          trancheDebut: row.Tranche_Debut || '',
          trancheFin: row.Tranche_Fin || '',
          mnemo: row['Mnémo'] || row.Mnemo || '',
          territoire: row.Territoire || '',
          dateAttribution: row.Date_Attribution || ''
        }));
        resolve(ranges);
      },
      error: (error) => reject(error)
    });
  });
}

export async function loadOperatorIdentities(): Promise<OperatorIdentity[]> {
  const response = await fetch('/data/identifiants_CE_2025-10-25.csv');
  const csvText = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
      complete: (results) => {
        const identities: OperatorIdentity[] = results.data.map((row: any) => ({
          identiteOperateur: row.IDENTITE_OPERATEUR || '',
          codeOperateur: row.CODE_OPERATEUR || '',
          siretActeur: row.SIRET_ACTEUR || '',
          rcsActeur: row.RCS_ACTEUR || '',
          adresseCompleteActeur: row.ADRESSE_COMPLETE_ACTEUR || '',
          attribRessNum: row.ATTRIB_RESS_NUM || '',
          dateDeclarationOperateur: row.DATE_DECLARATION_OPERATEUR || ''
        }));
        resolve(identities);
      },
      error: (error) => reject(error)
    });
  });
}
