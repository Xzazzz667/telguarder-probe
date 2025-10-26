import Papa from 'papaparse';
import { OperatorRange, OperatorIdentity } from '@/types';

// Decode CSV files that are encoded in ISO-8859-1 (ARCEP exports) with a UTF-8 fallback
async function fetchCsvText(path: string): Promise<string> {
  const res = await fetch(path);
  const buf = await res.arrayBuffer();

  // Try Latin-1 first (most ARCEP CSVs)
  const latin1 = new TextDecoder('iso-8859-1').decode(buf);
  if (!latin1.includes('�')) return latin1;

  // Fallback to UTF-8 if Latin-1 still shows replacement chars
  const utf8 = new TextDecoder('utf-8').decode(buf);
  const hasLessReplacements = (utf8.match(/�/g)?.length || 0) < (latin1.match(/�/g)?.length || 0);
  return hasLessReplacements ? utf8 : latin1;
}

export async function loadOperatorRanges(): Promise<OperatorRange[]> {
  const csvText = await fetchCsvText('/data/MAJNUM_2025-10-25.csv');

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
      complete: (results) => {
        console.log('Colonnes CSV MAJNUM:', results.meta.fields);
        console.log('Premier enregistrement:', results.data[0]);
        
        const ranges: OperatorRange[] = (results.data as any[])
          .map((row: any) => {
            const mnemo = row['Mnémo'] || row['Mnemo'] || row['Mn�mo'] || row['MNEMO'] || '';
            return {
              ezabpqm: row.EZABPQM || row.ezabpqm || '',
              trancheDebut: row.Tranche_Debut || row.tranche_debut || '',
              trancheFin: row.Tranche_Fin || row.tranche_fin || '',
              mnemo: String(mnemo).trim(),
              territoire: row.Territoire || row.territoire || '',
              dateAttribution: row.Date_Attribution || row.date_attribution || ''
            } as OperatorRange;
          })
          .filter(range => range.mnemo && range.trancheDebut && range.trancheFin);
        
        console.log(`${ranges.length} tranches chargées`);
        console.log('Exemple de tranche:', ranges[0]);
        resolve(ranges);
      },
      error: (error) => reject(error)
    });
  });
}

export async function loadOperatorIdentities(): Promise<OperatorIdentity[]> {
  const csvText = await fetchCsvText('/data/identifiants_CE_2025-10-25.csv');

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
      complete: (results) => {
        console.log('Colonnes CSV Identités:', results.meta.fields);
        console.log('Premier enregistrement identité:', results.data[0]);
        
        const identities: OperatorIdentity[] = (results.data as any[])
          .map((row: any) => ({
            identiteOperateur: (row.IDENTITE_OPERATEUR || row.identite_operateur || '').toString(),
            codeOperateur: (row.CODE_OPERATEUR || row.code_operateur || '').toString().trim(),
            siretActeur: row.SIRET_ACTEUR || row.siret_acteur || '',
            rcsActeur: row.RCS_ACTEUR || row.rcs_acteur || '',
            adresseCompleteActeur: row.ADRESSE_COMPLETE_ACTEUR || row.adresse_complete_acteur || '',
            attribRessNum: row.ATTRIB_RESS_NUM || row.attrib_ress_num || '',
            dateDeclarationOperateur: row.DATE_DECLARATION_OPERATEUR || row.date_declaration_operateur || ''
          }))
          .filter(identity => identity.codeOperateur);
        
        console.log(`${identities.length} identités chargées`);
        console.log("Exemple d'identité:", identities[0]);
        resolve(identities);
      },
      error: (error) => reject(error)
    });
  });
}
