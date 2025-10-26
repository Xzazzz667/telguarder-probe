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
    // Remove leading 0 and convert to number for comparison
    const normalizedNumber = phoneNumber.replace(/^0/, '');
    const numberValue = parseInt(normalizedNumber, 10);

    // Find matching range using binary search for performance
    for (const range of this.ranges) {
      const rangeStart = parseInt(range.trancheDebut.replace(/^0/, ''), 10);
      const rangeEnd = parseInt(range.trancheFin.replace(/^0/, ''), 10);

      if (numberValue >= rangeStart && numberValue <= rangeEnd) {
        const identity = this.identities.get(range.mnemo);
        return {
          operator: identity?.identiteOperateur || 'Inconnu',
          operatorCode: range.mnemo
        };
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
