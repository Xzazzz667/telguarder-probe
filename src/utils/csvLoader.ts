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
      encoding: 'UTF-8',
      complete: (results) => {
        console.log('Colonnes CSV MAJNUM:', results.meta.fields);
        console.log('Premier enregistrement:', results.data[0]);
        
        const ranges: OperatorRange[] = results.data.map((row: any) => {
          // Essayer différentes variantes de noms de colonnes
          const mnemo = row['Mnémo'] || row['Mnemo'] || row['Mn�mo'] || row['MNEMO'] || '';
          return {
            ezabpqm: row.EZABPQM || row.ezabpqm || '',
            trancheDebut: row.Tranche_Debut || row.tranche_debut || '',
            trancheFin: row.Tranche_Fin || row.tranche_fin || '',
            mnemo: mnemo.trim(),
            territoire: row.Territoire || row.territoire || '',
            dateAttribution: row.Date_Attribution || row.date_attribution || ''
          };
        }).filter(range => range.mnemo && range.trancheDebut && range.trancheFin);
        
        console.log(`${ranges.length} tranches chargées`);
        console.log('Exemple de tranche:', ranges[0]);
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
      encoding: 'UTF-8',
      complete: (results) => {
        console.log('Colonnes CSV Identités:', results.meta.fields);
        console.log('Premier enregistrement identité:', results.data[0]);
        
        const identities: OperatorIdentity[] = results.data.map((row: any) => ({
          identiteOperateur: row.IDENTITE_OPERATEUR || row.identite_operateur || '',
          codeOperateur: (row.CODE_OPERATEUR || row.code_operateur || '').trim(),
          siretActeur: row.SIRET_ACTEUR || row.siret_acteur || '',
          rcsActeur: row.RCS_ACTEUR || row.rcs_acteur || '',
          adresseCompleteActeur: row.ADRESSE_COMPLETE_ACTEUR || row.adresse_complete_acteur || '',
          attribRessNum: row.ATTRIB_RESS_NUM || row.attrib_ress_num || '',
          dateDeclarationOperateur: row.DATE_DECLARATION_OPERATEUR || row.date_declaration_operateur || ''
        })).filter(identity => identity.codeOperateur);
        
        console.log(`${identities.length} identités chargées`);
        console.log('Exemple d\'identité:', identities[0]);
        resolve(identities);
      },
      error: (error) => reject(error)
    });
  });
}
