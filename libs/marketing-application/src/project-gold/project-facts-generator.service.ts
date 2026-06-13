import { Injectable } from '@nestjs/common';
import { EntityType, FactType, Severity, type DetectedFact, type ProjectGoldSummary } from '@metrics-platform/marketing-shared';

@Injectable()
export class ProjectFactsGeneratorService {
  generate(summary: ProjectGoldSummary): DetectedFact[] {
    const base = {
      entityId: summary.projectId,
      entityType: EntityType.ACCOUNT,
      temporalContext: { lookbackDays: 0, startDate: summary.dateRangeStart ?? summary.dataAvailability.dateRangeStart ?? summary.generatedAt.slice(0, 10), endDate: summary.dateRangeEnd ?? summary.dataAvailability.dateRangeEnd ?? summary.generatedAt.slice(0, 10) },
      scopeType: 'PROJECT' as const,
      scopeId: summary.projectId,
      analysisRunId: summary.analysisRunId,
      source: summary.source,
      reportType: null,
      dateRangeStart: summary.dateRangeStart ?? summary.dataAvailability.dateRangeStart ?? null,
      dateRangeEnd: summary.dateRangeEnd ?? summary.dataAvailability.dateRangeEnd ?? null,
    };
    const facts: DetectedFact[] = [];
    const add = (factType: FactType, severity: Severity, confidence: number, metricsSummary: Record<string, unknown>, recommendationHint: string) => facts.push({ ...base, factType, severity, confidence, metricsSummary: { ...metricsSummary, source: summary.source, scopeType: 'PROJECT', scopeId: summary.projectId, analysisRunId: summary.analysisRunId, dateRangeStart: base.dateRangeStart, dateRangeEnd: base.dateRangeEnd }, recommendationHint });

    if (summary.periodFunnel.installs > 0 || summary.periodFunnel.registrationUsers > 0 || summary.periodFunnel.depositUsers > 0) add(FactType.PROJECT_ANALYSIS_READY, Severity.INFO, 0.98, { totalEvents: summary.kpis.total_events, validEvents: summary.kpis.total_valid_events }, 'Use the project-level Gold summary for general project questions and optimization planning.');
    if (summary.dataAvailability.hasInstalls && (summary.dataAvailability.hasInAppEvents || summary.dataAvailability.hasNonOrganicInAppEvents)) add(FactType.PROJECT_FUNNEL_AVAILABLE, Severity.INFO, 0.97, { periodFunnel: summary.periodFunnel }, 'Project period funnel is available; distinguish it from cohort rates when explaining results.');
    else add(FactType.PROJECT_FUNNEL_INCOMPLETE, Severity.WARNING, 0.95, { availability: summary.dataAvailability, periodLimitations: summary.periodFunnel.limitations }, 'Upload/process both installs and in-app events reports to complete the project funnel.');
    if (summary.cohortFunnel.available) add(FactType.PROJECT_COHORT_FUNNEL_AVAILABLE, Severity.INFO, 0.95, { cohortUsers: summary.cohortFunnel.cohortUsers, identityCoverageRate: summary.cohortFunnel.identityCoverageRate, windows: summary.cohortFunnel.windows }, 'Prefer cohort funnel rates for install-to-event questions when the requested window is available.');
    else add(FactType.PROJECT_COHORT_FUNNEL_INCOMPLETE, Severity.WARNING, 0.9, { limitations: summary.cohortFunnel.limitations, identityCoverageRate: summary.cohortFunnel.identityCoverageRate }, 'Do not fake cohort rates; explain why cohort matching is incomplete and fall back to period funnel only when appropriate.');
    if (!summary.dataAvailability.hasInstalls && (summary.dataAvailability.hasInAppEvents || summary.dataAvailability.hasNonOrganicInAppEvents)) add(FactType.PROJECT_MISSING_INSTALLS_REPORT, Severity.WARNING, 0.98, { availableReportTypes: summary.dataAvailability.availableReportTypes }, 'Process an AppsFlyer installs report to enable install-based and cohort rates.');
    if (summary.dataAvailability.hasInstalls && !summary.dataAvailability.hasInAppEvents && !summary.dataAvailability.hasNonOrganicInAppEvents) add(FactType.PROJECT_MISSING_IN_APP_EVENTS_REPORT, Severity.WARNING, 0.98, { availableReportTypes: summary.dataAvailability.availableReportTypes }, 'Process in-app events reports to analyze registrations, deposits, FTDs, and betting events.');
    add(FactType.PROJECT_NO_RELIABLE_COST_SOURCE, Severity.INFO, 1, { hasReliableCost: false, unavailableMetrics: ['ROAS', 'CPA', 'CAC'] }, 'Do not calculate or claim ROAS, CPA, or CAC until a reliable cost source such as Google Ads cost data is available.');
    if (Number(summary.kpis.non_empty_event_revenue_rows ?? 0) === 0 && Number(summary.kpis.non_empty_event_amount_rows ?? 0) > 0) add(FactType.PROJECT_EVENT_REVENUE_EMPTY, Severity.WARNING, 0.9, { nonEmptyEventAmountRows: summary.kpis.non_empty_event_amount_rows }, 'Explain that monetary values come from Event Value.amount because Event Revenue is empty.');
    if (summary.periodFunnel.depositAmount > 0 || summary.periodFunnel.betPlacedAmount !== 0 || summary.periodFunnel.betSettlementAmount !== 0) add(FactType.PROJECT_EVENT_AMOUNT_USED_AS_MONETARY_SOURCE, Severity.INFO, 0.95, { depositAmount: summary.periodFunnel.depositAmount, netBetAmountApprox: summary.periodFunnel.netBetAmountApprox }, 'Use Event Value.amount as a monetary event-value signal only; do not treat it as spend or profit.');
    if ((summary.blockedTraffic.blockedInstallRate ?? 0) >= 0.1) { add(FactType.HIGH_BLOCKED_TRAFFIC_RATE, Severity.WARNING, 0.92, { blockedInstallRate: summary.blockedTraffic.blockedInstallRate, blockedInstalls: summary.blockedTraffic.blockedInstalls }, 'Review source quality and fraud settings before scaling sources with high blocked install rates.'); add(FactType.PROJECT_HIGH_BLOCKED_TRAFFIC_RATE, Severity.WARNING, 0.92, { blockedInstallRate: summary.blockedTraffic.blockedInstallRate, blockedInstalls: summary.blockedTraffic.blockedInstalls }, 'Review source quality and fraud settings before scaling sources with high blocked install rates.'); }
    if ((summary.blockedTraffic.blockedEventRate ?? 0) >= 0.1) { add(FactType.HIGH_BLOCKED_IN_APP_EVENTS, Severity.WARNING, 0.92, { blockedEventRate: summary.blockedTraffic.blockedEventRate, blockedInAppEvents: summary.blockedTraffic.blockedInAppEvents }, 'Investigate blocked in-app event sources separately from the valid traffic funnel.'); add(FactType.PROJECT_HIGH_BLOCKED_IN_APP_EVENTS, Severity.WARNING, 0.92, { blockedEventRate: summary.blockedTraffic.blockedEventRate, blockedInAppEvents: summary.blockedTraffic.blockedInAppEvents }, 'Investigate blocked in-app event sources separately from the valid traffic funnel.'); }
    for (const issue of (((summary as any).dataQualitySummary?.issues ?? []) as any[])) {
      if (issue.code === 'INVALID_CAMPAIGN_MACROS_DETECTED') add(FactType.INVALID_CAMPAIGN_MACROS_DETECTED, Severity.WARNING, 0.9, issue.metrics ?? {}, 'Fix unresolved campaign macros before campaign-level decisions.');
      if (issue.code === 'UNKNOWN_CAMPAIGN_METADATA') add(FactType.UNKNOWN_CAMPAIGN_METADATA, Severity.WARNING, 0.88, issue.metrics ?? {}, 'Improve campaign metadata coverage before optimization.');
      if (issue.code === 'HIGH_UNKNOWN_EVENT_MAPPING_RATE') add(FactType.HIGH_UNKNOWN_EVENT_MAPPING_RATE, Severity.WARNING, 0.86, issue.metrics ?? {}, 'Review unmapped AppsFlyer event names before Google Ads work.');
    }
    const best = summary.mediaSourceQuality.rows[0];
    const worst = summary.mediaSourceQuality.rows[summary.mediaSourceQuality.rows.length - 1];
    if (best && worst && best.mediaSource !== worst.mediaSource && best.score - worst.score >= 20) add(FactType.PROJECT_MEDIA_SOURCE_QUALITY_DIFFERENCE, Severity.INFO, 0.88, { best, worst, scoreDelta: best.score - worst.score }, 'Compare top and bottom media sources by quality score, but do not claim profitability without cost.');
    const conversionEvents = Number(summary.kpis.conversion_event_volume ?? 0);
    const engagementEvents = Number(summary.kpis.engagement_events ?? 0);
    if (engagementEvents > conversionEvents * 5 && engagementEvents > 0) add(FactType.PROJECT_NOISY_EVENT_DISTRIBUTION, Severity.WARNING, 0.82, { engagementEvents, conversionEvents }, 'Prioritize conversion events when diagnosing performance; engagement-heavy mixes can obscure quality.');
    if (summary.cohortFunnel.cohortUsers > 0 && summary.cohortFunnel.identityCoverageRate < 0.5) add(FactType.PROJECT_INSUFFICIENT_IDENTITY_COVERAGE, Severity.WARNING, 0.9, { identityCoverageRate: summary.cohortFunnel.identityCoverageRate }, 'Improve user identifier coverage to support reliable cohort matching.');
    if (Number(summary.kpis.retargeting_events ?? 0) > 0) add(FactType.PROJECT_RETARGETING_PRESENT, Severity.INFO, 0.85, { retargetingEvents: summary.kpis.retargeting_events }, 'Separate retargeting from acquisition when interpreting project performance.');
    return facts;
  }
}
