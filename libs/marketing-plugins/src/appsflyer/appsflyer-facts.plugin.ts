import { Injectable } from '@nestjs/common';
import { EntityType, FactType, ReportType, Severity, type DetectedFact } from '@metrics-platform/marketing-shared';
import type { AppsFlyerKpiResult, AppsFlyerProcessingContext, AppsFlyerReportProfileResult } from './appsflyer.types';

@Injectable()
export class AppsFlyerFactsPlugin {
  generate(context: AppsFlyerProcessingContext, profile: AppsFlyerReportProfileResult, kpis: AppsFlyerKpiResult): DetectedFact[] {
    const facts: DetectedFact[] = [...profile.preparedFacts];
    const temporalContext = this.temporalContext();
    const base = { entityId: context.projectId, entityType: EntityType.ACCOUNT, temporalContext };

    if (kpis.totalNormalizedEvents > 0 && kpis.eventRevenueEmptyCount / kpis.totalNormalizedEvents >= 0.8 && this.isEventReport(context.reportType)) {
      facts.push({ ...base, factType: FactType.EVENT_REVENUE_EMPTY, severity: Severity.WARNING, confidence: 0.9, metricsSummary: { eventRevenueEmptyCount: kpis.eventRevenueEmptyCount, totalEvents: kpis.totalNormalizedEvents }, recommendationHint: 'Event Revenue is mostly empty. Use Event Value.amount where valid, and validate AppsFlyer revenue mapping.' });
    }
    if (kpis.eventAmountInJsonCount > 0) {
      facts.push({ ...base, factType: FactType.EVENT_AMOUNT_IN_JSON, severity: Severity.INFO, confidence: 0.92, metricsSummary: { eventAmountInJsonCount: kpis.eventAmountInJsonCount, totalEvents: kpis.totalNormalizedEvents }, recommendationHint: 'Monetary amount was detected inside Event Value JSON. Treat it as the primary AppsFlyer value field when Event Revenue is blank.' });
    }
    if (context.source === 'APPSFLYER' && !kpis.hasReliableCostSource) {
      facts.push({ ...base, factType: FactType.NO_RELIABLE_COST_SOURCE, severity: Severity.INFO, confidence: 0.99, metricsSummary: { totalEvents: kpis.totalNormalizedEvents, hasReliableCostSource: false }, recommendationHint: 'AppsFlyer-only imports do not provide reliable ad cost for ROAS. Import Google Ads or another trusted cost source before calculating ROAS.' });
    }
    if (kpis.blockedEventsRate !== null && kpis.blockedEventsCount >= 10 && kpis.blockedEventsRate >= 0.2) {
      facts.push({ ...base, factType: FactType.HIGH_BLOCKED_TRAFFIC_RATE, severity: Severity.WARNING, confidence: 0.88, metricsSummary: { blockedEventsCount: kpis.blockedEventsCount, blockedEventsRate: kpis.blockedEventsRate }, recommendationHint: 'Blocked traffic volume is material. Review fraud protection reasons by media source and campaign.' });
    }
    if (context.reportType === ReportType.BLOCKED_IN_APP_EVENTS && kpis.blockedEventsCount >= 10) {
      facts.push({ ...base, factType: FactType.HIGH_BLOCKED_IN_APP_EVENTS, severity: Severity.WARNING, confidence: 0.88, metricsSummary: { blockedEventsCount: kpis.blockedEventsCount }, recommendationHint: 'Blocked in-app events are significant. Segment by media source and event type to identify suspicious traffic.' });
    }
    if (this.hasMediaSourceQualityDifference(kpis)) {
      facts.push({ ...base, factType: FactType.MEDIA_SOURCE_QUALITY_DIFFERENCE, severity: Severity.INFO, confidence: 0.8, metricsSummary: { eventsByMediaSource: kpis.eventsByMediaSource, deposits: kpis.deposits, firstDeposits: kpis.firstDeposits }, recommendationHint: 'Event quality differs by media source. Compare registration/deposit mix before shifting budget.' });
    }
    const conversionEvents = kpis.registrations + kpis.deposits + kpis.firstDeposits;
    const noisyEvents = kpis.engagementEvents + kpis.loginEvents;
    if (kpis.totalNormalizedEvents >= 20 && noisyEvents / kpis.totalNormalizedEvents >= 0.8 && conversionEvents / kpis.totalNormalizedEvents <= 0.05) {
      facts.push({ ...base, factType: FactType.NOISY_EVENT_DISTRIBUTION, severity: Severity.WARNING, confidence: 0.84, metricsSummary: { noisyEvents, conversionEvents, totalEvents: kpis.totalNormalizedEvents }, recommendationHint: 'Engagement/login events dominate while conversion events are sparse. Separate high-signal conversion analysis from noisy engagement events.' });
    }
    return facts;
  }

  private temporalContext() { const today = new Date().toISOString().slice(0, 10); return { lookbackDays: 0, startDate: today, endDate: today }; }
  private isEventReport(reportType: ReportType): boolean { return [ReportType.IN_APP_EVENTS, ReportType.NON_ORGANIC_IN_APP_EVENTS, ReportType.IN_APP_EVENTS_POSTBACKS, ReportType.BLOCKED_IN_APP_EVENTS, ReportType.AD_REVENUE, ReportType.CONVERSIONS].includes(reportType); }
  private hasMediaSourceQualityDifference(kpis: AppsFlyerKpiResult): boolean { return Object.keys(kpis.eventsByMediaSource).length >= 2 && (kpis.deposits + kpis.firstDeposits + kpis.registrations) > 0; }
}
