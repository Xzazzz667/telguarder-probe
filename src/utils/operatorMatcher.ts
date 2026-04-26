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
    // Nettoyer le numéro (retirer espaces, tirets, +, etc.)
    let cleanNumber = phoneNumber.replace(/\D/g, '');

    // Normaliser vers le format national 0XXXXXXXXX (10 chiffres) pour la comparaison
    // car les tranches MAJNUM sont au format 0XXXXXXXXX
    if (cleanNumber.startsWith('0033') && cleanNumber.length === 13) {
      cleanNumber = '0' + cleanNumber.slice(4);
    } else if (cleanNumber.startsWith('33') && cleanNumber.length === 11) {
      cleanNumber = '0' + cleanNumber.slice(2);
    }

    if (!cleanNumber || cleanNumber.length !== 10 || !cleanNumber.startsWith('0')) {
      return {
        operator: 'Inconnu',
        operatorCode: 'INVALID'
      };
    }

    const fullNumber = cleanNumber;
    
    // Chercher la tranche correspondante
    for (const range of this.ranges) {
      // Les tranches dans le CSV sont au format 0XXXXXXXXX (10 chiffres)
      const rangeStart = range.trancheDebut.replace(/\D/g, '');
      const rangeEnd = range.trancheFin.replace(/\D/g, '');
      
      if (!rangeStart || !rangeEnd || rangeStart.length !== 10 || rangeEnd.length !== 10) {
        continue;
      }

      // Comparaison numérique directe
      const numValue = parseInt(fullNumber, 10);
      const numStart = parseInt(rangeStart, 10);
      const numEnd = parseInt(rangeEnd, 10);

      if (numValue >= numStart && numValue <= numEnd) {
        const identity = this.identities.get(range.mnemo);
        
        if (identity) {
          return {
            operator: identity.identiteOperateur,
            operatorCode: range.mnemo
          };
        } else {
          return {
            operator: range.mnemo,
            operatorCode: range.mnemo
          };
        }
      }
    }

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
