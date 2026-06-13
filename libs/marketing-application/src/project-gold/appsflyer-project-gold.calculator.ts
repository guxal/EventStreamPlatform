import { Injectable, Logger } from '@nestjs/common';
import { ReportType, type ProjectBlockedTrafficSummary, type ProjectDataAvailabilitySummary, type ProjectGoldSummary } from '@metrics-platform/marketing-shared';
import { AppsFlyerEventsRepository, ClickHouseProjectAnalyticsRepository } from '@metrics-platform/marketing-infrastructure';
import { AppsFlyerCohortFunnelCalculator } from './appsflyer-cohort-funnel.calculator';
import { AppsFlyerMediaSourceQualityCalculator } from './appsflyer-media-source-quality.calculator';
import { AppsFlyerPeriodFunnelCalculator } from './appsflyer-period-funnel.calculator';

const CORE_REPORT_TYPES = [ReportType.INSTALLS, ReportType.IN_APP_EVENTS, ReportType.NON_ORGANIC_IN_APP_EVENTS];
const SUPPORTED = [ReportType.INSTALLS, ReportType.IN_APP_EVENTS, ReportType.NON_ORGANIC_IN_APP_EVENTS, ReportType.IN_APP_EVENTS_POSTBACKS, ReportType.CONVERSIONS, ReportType.BLOCKED_INSTALLS, ReportType.BLOCKED_CLICKS, ReportType.BLOCKED_IN_APP_EVENTS, ReportType.AD_REVENUE, ReportType.UNINSTALLS];

@Injectable()
export class AppsFlyerProjectGoldCalculator {
  private readonly logger = new Logger(AppsFlyerProjectGoldCalculator.name);
  constructor(
    private readonly analyticsRepository: ClickHouseProjectAnalyticsRepository,
    private readonly appsFlyerEventsRepository: AppsFlyerEventsRepository,
    private readonly periodCalculator: AppsFlyerPeriodFunnelCalculator,
    private readonly cohortCalculator: AppsFlyerCohortFunnelCalculator,
    private readonly mediaSourceCalculator: AppsFlyerMediaSourceQualityCalculator,
  ) {}

  async calculate(input: { projectId: string; analysisRunId?: string; source: string; dateRangeStart?: string | null; dateRangeEnd?: string | null; correlationId?: string }): Promise<ProjectGoldSummary> {
    const filters = { source: input.source, dateRangeStart: input.dateRangeStart, dateRangeEnd: input.dateRangeEnd };
    const reportCounts = await this.analyticsRepository.getReportTypeCounts(input.projectId, filters);
    const availability = this.availability(reportCounts, input.dateRangeStart, input.dateRangeEnd);
    this.logger.log({ event: 'PROJECT_DATA_AVAILABILITY_COMPUTED', projectId: input.projectId, correlationId: input.correlationId, availableReportTypes: availability.availableReportTypes.length });
    const periodRaw = await this.analyticsRepository.getPeriodFunnel(input.projectId, filters);
    const periodFunnel = this.periodCalculator.calculate(periodRaw);
    this.logger.log({ event: 'PROJECT_PERIOD_FUNNEL_COMPUTED', projectId: input.projectId, correlationId: input.correlationId, installs: periodFunnel.installs, ftdUsers: periodFunnel.ftdUsers });
    const cohortRaw = await this.analyticsRepository.getCohortFunnel(input.projectId, filters, this.cohortCalculator.windows);
    const cohortFunnel = this.cohortCalculator.calculate(cohortRaw, availability);
    this.logger.log({ event: 'PROJECT_COHORT_FUNNEL_COMPUTED', projectId: input.projectId, correlationId: input.correlationId, available: cohortFunnel.available, cohortUsers: cohortFunnel.cohortUsers });
    const blockedRaw = await this.analyticsRepository.getBlockedTraffic(input.projectId, filters);
    const blockedTraffic = this.blocked(blockedRaw);
    this.logger.log({ event: 'PROJECT_BLOCKED_TRAFFIC_COMPUTED', projectId: input.projectId, correlationId: input.correlationId, blockedInstalls: blockedTraffic.blockedInstalls, blockedInAppEvents: blockedTraffic.blockedInAppEvents });
    const mediaSourceQuality = this.mediaSourceCalculator.calculate(await this.analyticsRepository.getMediaSourceQuality(input.projectId, filters));
    const campaignMetrics = await this.analyticsRepository.getCampaignMetrics(input.projectId, filters);
    const [campaignQuality, eventDictionaryCoverage, dataQualitySummary] = await Promise.all([
      this.appsFlyerEventsRepository.getCampaignQuality(input.projectId, { from: input.dateRangeStart ?? undefined, to: input.dateRangeEnd ?? undefined, trafficScope: 'valid', limit: 100 }),
      this.appsFlyerEventsRepository.getEventDictionaryCoverage(input.projectId, { from: input.dateRangeStart ?? undefined, to: input.dateRangeEnd ?? undefined }),
      this.appsFlyerEventsRepository.getDataQuality(input.projectId, { from: input.dateRangeStart ?? undefined, to: input.dateRangeEnd ?? undefined }),
    ]);
    this.logger.log({ event: 'PROJECT_MEDIA_SOURCE_QUALITY_COMPUTED', projectId: input.projectId, correlationId: input.correlationId, mediaSources: mediaSourceQuality.rows.length });
    const limitations = [...availability.limitations, ...periodFunnel.limitations, ...cohortFunnel.limitations, ...mediaSourceQuality.limitations];
    const kpis = this.kpis(availability, periodRaw, periodFunnel, cohortFunnel, blockedTraffic, mediaSourceQuality.rows.length);
    const resolvedStart = input.dateRangeStart ?? (String(periodRaw.periodStart || '') || null);
    const resolvedEnd = input.dateRangeEnd ?? (String(periodRaw.periodEnd || '') || null);
    availability.dateRangeStart = resolvedStart;
    availability.dateRangeEnd = resolvedEnd;
    return { projectId: input.projectId, source: input.source.toLowerCase(), analysisRunId: input.analysisRunId, dateRangeStart: resolvedStart, dateRangeEnd: resolvedEnd, dataAvailability: availability, periodFunnel, cohortFunnel, mediaSourceQuality, campaignMetrics, campaignQuality, eventDictionaryCoverage, dataQualitySummary, blockedTraffic, kpis, limitations, generatedAt: new Date().toISOString() };
  }

  private availability(rows: Array<{ reportType: string; events: number }>, dateRangeStart?: string | null, dateRangeEnd?: string | null): ProjectDataAvailabilitySummary {
    const available = rows.filter((row) => row.events > 0).map((row) => row.reportType);
    const has = (type: ReportType) => available.includes(type);
    const missing = SUPPORTED.filter((type) => !has(type));
    const limitations = ['AppsFlyer does not provide a reliable advertising cost source for ROAS/CPA/CAC in this V1 project analysis.'];
    if (!has(ReportType.INSTALLS)) limitations.push('No installs report is available; install-based cohort analysis is incomplete.');
    if (!has(ReportType.IN_APP_EVENTS) && !has(ReportType.NON_ORGANIC_IN_APP_EVENTS)) limitations.push('No in-app events report is available; deposit/FTD analysis is incomplete.');
    return { hasInstalls: has(ReportType.INSTALLS), hasInAppEvents: has(ReportType.IN_APP_EVENTS), hasNonOrganicInAppEvents: has(ReportType.NON_ORGANIC_IN_APP_EVENTS), hasBlockedInstalls: has(ReportType.BLOCKED_INSTALLS), hasBlockedClicks: has(ReportType.BLOCKED_CLICKS), hasBlockedInAppEvents: has(ReportType.BLOCKED_IN_APP_EVENTS), hasAdRevenue: has(ReportType.AD_REVENUE), hasUninstalls: has(ReportType.UNINSTALLS), hasReliableCost: false, availableReportTypes: available, missingReportTypes: missing, dateRangeStart: dateRangeStart ?? null, dateRangeEnd: dateRangeEnd ?? null, limitations };
  }

  private blocked(raw: { totals: Record<string, number>; reasons: Array<{ reason: string; count: number }>; mediaSources: Array<{ mediaSource: string; count: number }> }): ProjectBlockedTrafficSummary {
    const blockedInstalls = this.num(raw.totals.blockedInstalls), acceptedInstalls = this.num(raw.totals.acceptedInstalls), blockedInAppEvents = this.num(raw.totals.blockedInAppEvents), acceptedInAppEvents = this.num(raw.totals.acceptedInAppEvents);
    return { blockedInstalls, acceptedInstalls, blockedInstallRate: blockedInstalls + acceptedInstalls > 0 ? blockedInstalls / (blockedInstalls + acceptedInstalls) : null, blockedInAppEvents, acceptedInAppEvents, blockedEventRate: blockedInAppEvents + acceptedInAppEvents > 0 ? blockedInAppEvents / (blockedInAppEvents + acceptedInAppEvents) : null, blockedReasonsDistribution: raw.reasons, blockedMediaSourceDistribution: raw.mediaSources };
  }

  private kpis(availability: ProjectDataAvailabilitySummary, raw: Record<string, number | string>, period: ProjectGoldSummary['periodFunnel'], cohort: ProjectGoldSummary['cohortFunnel'], blocked: ProjectBlockedTrafficSummary, mediaSources: number): Record<string, number | string | boolean | null> {
    return {
      available_report_types_count: availability.availableReportTypes.length, missing_core_report_types_count: CORE_REPORT_TYPES.filter((type) => availability.missingReportTypes.includes(type)).length, has_installs: availability.hasInstalls, has_in_app_events: availability.hasInAppEvents || availability.hasNonOrganicInAppEvents, has_blocked_traffic: blocked.blockedInstalls + blocked.blockedInAppEvents > 0, has_reliable_cost: false,
      total_events: this.num(raw.totalEvents), total_valid_events: this.num(raw.totalValidEvents), total_blocked_events: this.num(raw.totalBlockedEvents), installs: period.installs, registrations: period.registrationUsers, deposit_users: period.depositUsers, deposit_events: period.depositEvents, ftd_users: period.ftdUsers, ftd_events: period.ftdEvents, login_users: period.loginUsers, engagement_events: period.engagementEvents,
      period_install_to_register_rate: period.installToRegisterRate, period_install_to_deposit_rate: period.installToDepositRate, period_install_to_ftd_rate: period.installToFtdRate,
      cohort_d0_install_to_ftd_rate: cohort.windows.D0?.installToFtdRate ?? null, cohort_d1_install_to_ftd_rate: cohort.windows.D1?.installToFtdRate ?? null, cohort_d3_install_to_ftd_rate: cohort.windows.D3?.installToFtdRate ?? null, cohort_d7_install_to_ftd_rate: cohort.windows.D7?.installToFtdRate ?? null, cohort_d30_install_to_ftd_rate: cohort.windows.D30?.installToFtdRate ?? null,
      deposit_amount: period.depositAmount, bet_placed_amount: period.betPlacedAmount, bet_settlement_amount: period.betSettlementAmount, net_bet_amount_approx: period.netBetAmountApprox,
      blocked_installs: blocked.blockedInstalls, blocked_in_app_events: blocked.blockedInAppEvents, blocked_install_rate: blocked.blockedInstallRate, blocked_event_rate: blocked.blockedEventRate, media_sources_count: mediaSources,
      non_empty_event_revenue_rows: this.num(raw.nonEmptyEventRevenueRows), non_empty_event_amount_rows: this.num(raw.nonEmptyEventAmountRows), retargeting_events: this.num(raw.retargetingEvents), conversion_event_volume: period.registrationUsers + period.depositEvents + period.ftdEvents,
    };
  }

  private num(value: unknown): number { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
}
