export type NewsAlertKind = 'positive' | 'negative' | 'any';

export interface NewsAlert {
  id: string;
  symbol: string;
  kind: NewsAlertKind;
  enabled: boolean;
  createdAt: string;
}
