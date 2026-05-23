export type DashboardSummary = {
  projectId: string;
  period: string;
  totals: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conversionValue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
  };
};

export type CampaignRow = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  roas: number;
};

export type KeywordRow = {
  id: string;
  text: string;
  matchType: 'BROAD' | 'PHRASE' | 'EXACT';
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
};

export type AiChatPayload = {
  query: string;
};
