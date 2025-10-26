import { OperatorRange, OperatorIdentity, ScrapedNumber } from '@/types';

export class OperatorMatcher {
  private ranges: OperatorRange[] = [];
  private identities: Map<string, OperatorIdentity> = new Map();

  setRanges(ranges: OperatorRange[]) {
    this.ranges = ranges;
  }

  setIdentities(identities: OperatorIdentity[]) {
    this.identities.clear();
    identities.forEach(identity => {
      this.identities.set(identity.codeOperateur, identity);
    });
  }

  matchNumber(phoneNumber: string): { operator: string; operatorCode: string } {
    // Nettoyer le numéro (retirer espaces, tirets, etc.)
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Retirer le 0 initial pour la comparaison
    const normalizedNumber = cleanNumber.replace(/^0/, '');
    
    if (!normalizedNumber || normalizedNumber.length < 9) {
      console.warn(`Numéro invalide: ${phoneNumber}`);
      return {
        operator: 'Inconnu',
        operatorCode: 'INVALID'
      };
    }

    // Chercher la tranche correspondante
    for (const range of this.ranges) {
      // Nettoyer les tranches aussi
      const rangeStart = range.trancheDebut.replace(/\D/g, '').replace(/^0/, '');
      const rangeEnd = range.trancheFin.replace(/\D/g, '').replace(/^0/, '');
      
      if (!rangeStart || !rangeEnd) continue;

      // Comparaison en tant que strings pour éviter les problèmes de précision
      // On prend la longueur de la plus courte chaîne pour la comparaison
      const compareLength = Math.min(normalizedNumber.length, rangeStart.length);
      const numberPrefix = normalizedNumber.substring(0, compareLength);
      const rangeStartPrefix = rangeStart.substring(0, compareLength);
      const rangeEndPrefix = rangeEnd.substring(0, compareLength);

      if (numberPrefix >= rangeStartPrefix && numberPrefix <= rangeEndPrefix) {
        const identity = this.identities.get(range.mnemo);
        
        if (identity) {
          console.log(`Match trouvé: ${phoneNumber} -> ${identity.identiteOperateur} (${range.mnemo})`);
          return {
            operator: identity.identiteOperateur,
            operatorCode: range.mnemo
          };
        } else {
          console.warn(`Mnémo ${range.mnemo} trouvé mais pas d'identité correspondante`);
          return {
            operator: range.mnemo,
            operatorCode: range.mnemo
          };
        }
      }
    }

    console.warn(`Pas de tranche trouvée pour: ${phoneNumber}`);
    return {
      operator: 'Inconnu',
      operatorCode: 'UNKNOWN'
    };
  }

  matchNumbers(numbers: ScrapedNumber[]): ScrapedNumber[] {
    return numbers.map(number => ({
      ...number,
      ...this.matchNumber(number.phoneNumber)
    }));
  }
}

export const operatorMatcher = new OperatorMatcher();
