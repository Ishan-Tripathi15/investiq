export interface NewsSentiment {
  label: 'positive' | 'neutral' | 'negative';
  score: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface NewsArticle {
  id: string;
  title: string;
  description?: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  symbol?: string;
  category: 'market' | 'company' | 'economy' | 'other';
  sentiment: NewsSentiment;
}

export interface NewsResponse {
  available: boolean;
  articles: NewsArticle[];
  source: string | null;
  retrievedAt: string;
  message?: string;
}