import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetMetricQuery, ListMetricsQuery } from '@metrics-platform/core-application';
import { FactType, Severity } from '@metrics-platform/marketing-shared';
import type { AiChatPayload, CampaignRow, DashboardSummary, KeywordRow } from './reader.types';

@Injectable()
export class AppService {
  constructor(private readonly queryBus: QueryBus) {}

  async handleGetMetric(metricName: string, period: string, store: 'db' | 'redis' = 'db') {
    return this.queryBus.execute(new GetMetricQuery(metricName, period, store));
  }

  async handleListMetrics(metricName?: string, fromPeriod?: string, toPeriod?: string) {
    return this.queryBus.execute(new ListMetricsQuery(metricName, fromPeriod, toPeriod));
  }

  getProjectDashboard(projectId: string, period = 'last_7_days'): DashboardSummary {
    return {
      projectId,
      period,
      totals: {
        impressions: 100000,
        clicks: 4500,
        cost: 3200,
        conversions: 210,
        conversionValue: 12800,
        ctr: 0.045,
        cpc: 0.71,
        cpa: 15.24,
        roas: 4,
      },
    };
  }

  listProjectCampaigns(_projectId: string): CampaignRow[] {
    return [
      { id: 'camp_1', name: 'Brand Search', status: 'ACTIVE', impressions: 25000, clicks: 2300, cost: 900, conversions: 120, roas: 5.2 },
      { id: 'camp_2', name: 'Non-Brand', status: 'ACTIVE', impressions: 50000, clicks: 1600, cost: 1500, conversions: 60, roas: 2.1 },
    ];
  }

  listProjectKeywords(_projectId: string): KeywordRow[] {
    return [
      { id: 'kw_1', text: 'crm software', matchType: 'PHRASE', impressions: 10000, clicks: 500, cost: 420, conversions: 20 },
      { id: 'kw_2', text: 'best crm tool', matchType: 'EXACT', impressions: 8000, clicks: 430, cost: 300, conversions: 24 },
    ];
  }

  listProjectFacts(projectId: string) {
    return [
      {
        id: 'fact_1',
        projectId,
        factType: FactType.HIGH_SPEND_ZERO_CONVERSIONS,
        severity: Severity.CRITICAL,
        confidence: 0.98,
      },
    ];
  }

  listProjectRecommendations(projectId: string) {
    return [
      {
        id: 'rec_1',
        projectId,
        title: 'Pause wasteful campaign segment',
        priority: 'CRITICAL',
      },
    ];
  }

  listProjectReports(projectId: string) {
    return [
      {
        id: 'rep_1',
        projectId,
        title: 'AI Marketing Performance Report',
        reportType: 'WEEKLY',
      },
    ];
  }

  askAiChat(projectId: string, payload: AiChatPayload) {
    return {
      projectId,
      query: payload.query,
      response:
        'Based on detected facts, the top issue is high spend with zero conversions. Recommend tightening targeting and validating landing-page relevance.',
      source: 'facts-first',
    };
  }
}
