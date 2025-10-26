export interface ScrapedNumber {
  id: string;
  phoneNumber: string;
  rawNumber: string;
  category: string;
  comment: string;
  date: string;
  operator?: string;
  operatorCode?: string;
}

export interface OperatorRange {
  ezabpqm: string;
  trancheDebut: string;
  trancheFin: string;
  mnemo: string;
  territoire: string;
  dateAttribution: string;
}

export interface OperatorIdentity {
  identiteOperateur: string;
  codeOperateur: string;
  siretActeur: string;
  rcsActeur: string;
  adresseCompleteActeur: string;
  attribRessNum: string;
  dateDeclarationOperateur: string;
}

export interface FilterState {
  operator: string;
  category: string;
  searchTerm: string;
  dateFrom: string;
  dateTo: string;
}

export interface Stats {
  totalNumbers: number;
  categoryCounts: Record<string, number>;
  operatorCounts: Record<string, number>;
}
