import { Injectable } from '@nestjs/common';
import { CanonicalEventType, ReportType } from '@metrics-platform/marketing-shared';
import { ClickHouseQueryClient } from './clickhouse-query.util';

export type AppsFlyerEventFilters = {
  from?: string;
  to?: string;
  importId?: string;
  reportType?: string;
  mediaSource?: string;
  campaignName?: string;
  canonicalEventName?: string;
};

@Injectable()
export class AppsFlyerEventsRepository {
  private readonly client = new ClickHouseQueryClient();

  async getOverview(projectId: string) {
    const rows = await this.client.query<Record<string, unknown>>(
      `SELECT
        count() AS totalEvents,
        uniqExact(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''))) AS uniqueUsers,
        countIf(canonical_event_name = '${CanonicalEventType.REGISTRATION}') AS registrations,
        countIf(canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS deposits,
        countIf(canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS firstDeposits,
        sumIf(toFloat64(ifNull(event_amount, 0)), canonical_event_name IN ('${CanonicalEventType.DEPOSIT}', '${CanonicalEventType.FIRST_DEPOSIT}')) AS depositAmount,
        sumIf(toFloat64(ifNull(event_amount, 0)), canonical_event_name = '${CanonicalEventType.BET_PLACED}') AS betPlacedAmount,
        sumIf(toFloat64(ifNull(event_amount, 0)), canonical_event_name = '${CanonicalEventType.BET_SETTLEMENT}') AS betSettlementAmount,
        countIf(is_blocked = 1) AS blockedEvents,
        if(count() = 0, NULL, countIf(is_blocked = 1) / count()) AS blockedRate,
        countIf(report_type = '${ReportType.BLOCKED_INSTALLS}') AS blockedInstalls,
        countIf(report_type = '${ReportType.BLOCKED_CLICKS}') AS blockedClicks,
        countIf(report_type = '${ReportType.BLOCKED_IN_APP_EVENTS}') AS blockedInAppEvents,
        countIf(canonical_event_name = '${CanonicalEventType.LOGIN}') AS loginEvents,
        countIf(canonical_event_name = '${CanonicalEventType.ENGAGEMENT}') AS engagementEvents
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER'`,
    );
    const row: Record<string, unknown> = rows[0] ?? {};
    const betPlacedAmount = this.num(row.betPlacedAmount);
    const betSettlementAmount = this.num(row.betSettlementAmount);
    return {
      totalEvents: this.num(row.totalEvents),
      uniqueUsers: this.num(row.uniqueUsers),
      registrations: this.num(row.registrations),
      deposits: this.num(row.deposits),
      firstDeposits: this.num(row.firstDeposits),
      depositAmount: this.num(row.depositAmount),
      betPlacedAmount,
      betSettlementAmount,
      approximateNetBetAmount: betSettlementAmount - betPlacedAmount,
      blockedEvents: this.num(row.blockedEvents),
      blockedRate: row.blockedRate === null || row.blockedRate === undefined ? null : this.num(row.blockedRate),
      blockedInstalls: this.num(row.blockedInstalls),
      blockedClicks: this.num(row.blockedClicks),
      blockedInAppEvents: this.num(row.blockedInAppEvents),
      loginEvents: this.num(row.loginEvents),
      engagementEvents: this.num(row.engagementEvents),
      unavailableMetrics: [
        { metric: 'roas', reason: 'AppsFlyer-only data has no reliable cost source.' },
        { metric: 'cpa', reason: 'AppsFlyer-only data has no reliable cost source.' },
        { metric: 'install_to_deposit_rate', reason: 'Requires comparable install and event data for the same period.' },
        { metric: 'install_to_ftd_rate', reason: 'Requires comparable install and first-deposit event data for the same period.' },
      ],
      warnings: this.num(row.totalEvents) > 0 ? [] : ['No AppsFlyer events found for this project.'],
    };
  }

  async getEventsByName(projectId: string, filters: AppsFlyerEventFilters = {}) {
    return this.client.query(
      `SELECT
        event_name AS eventName,
        canonical_event_name AS canonicalEventName,
        count() AS count,
        uniqExact(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''))) AS uniqueUsers,
        sum(toFloat64(ifNull(event_amount, 0))) AS totalAmount,
        sum(toFloat64(ifNull(event_revenue, 0))) AS totalRevenue
       FROM marketing.marketing_events FINAL
       WHERE ${this.where(projectId, filters)}
       GROUP BY event_name, canonical_event_name
       ORDER BY count DESC`,
    );
  }

  async getMediaSources(projectId: string) {
    return this.client.query(
      `SELECT
        coalesce(media_source, 'unknown') AS mediaSource,
        count() AS events,
        uniqExact(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''))) AS uniqueUsers,
        countIf(canonical_event_name = '${CanonicalEventType.REGISTRATION}') AS registrations,
        countIf(canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS deposits,
        countIf(canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS firstDeposits,
        sumIf(toFloat64(ifNull(event_amount, 0)), canonical_event_name IN ('${CanonicalEventType.DEPOSIT}', '${CanonicalEventType.FIRST_DEPOSIT}')) AS depositAmount,
        countIf(is_blocked = 1) AS blockedEvents
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER'
       GROUP BY media_source
       ORDER BY events DESC`,
    );
  }

  async getCampaigns(projectId: string) {
    return this.client.query(
      `SELECT
        coalesce(campaign_name, 'unknown') AS campaignName,
        campaign_id AS campaignId,
        coalesce(media_source, 'unknown') AS mediaSource,
        count() AS events,
        uniqExact(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''))) AS uniqueUsers,
        countIf(canonical_event_name = '${CanonicalEventType.REGISTRATION}') AS registrations,
        countIf(canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS deposits,
        countIf(canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS firstDeposits,
        sumIf(toFloat64(ifNull(event_amount, 0)), canonical_event_name IN ('${CanonicalEventType.DEPOSIT}', '${CanonicalEventType.FIRST_DEPOSIT}')) AS depositAmount,
        countIf(is_blocked = 1) AS blockedEvents
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER'
       GROUP BY campaign_name, campaign_id, media_source
       ORDER BY events DESC`,
    );
  }

  async getBlockedTraffic(projectId: string) {
    const totals = await this.client.query<Record<string, unknown>>(
      `SELECT
        countIf(report_type = '${ReportType.BLOCKED_INSTALLS}') AS blockedInstalls,
        countIf(report_type = '${ReportType.BLOCKED_CLICKS}') AS blockedClicks,
        countIf(report_type = '${ReportType.BLOCKED_IN_APP_EVENTS}') AS blockedInAppEvents
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER'`,
    );
    const blockedReasons = await this.client.query(
      `SELECT coalesce(blocked_reason, 'unknown') AS reason, count() AS count
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER' AND is_blocked = 1
       GROUP BY blocked_reason ORDER BY count DESC`,
    );
    const rejectedReasons = await this.client.query(
      `SELECT coalesce(rejected_reason, 'unknown') AS reason, count() AS count
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER' AND is_blocked = 1
       GROUP BY rejected_reason ORDER BY count DESC`,
    );
    const blockedByMediaSource = await this.client.query(
      `SELECT coalesce(media_source, 'unknown') AS mediaSource, count() AS blockedEvents
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER' AND is_blocked = 1
       GROUP BY media_source ORDER BY blockedEvents DESC`,
    );
    const blockedByCampaign = await this.client.query(
      `SELECT coalesce(campaign_name, 'unknown') AS campaignName, campaign_id AS campaignId, count() AS blockedEvents
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER' AND is_blocked = 1
       GROUP BY campaign_name, campaign_id ORDER BY blockedEvents DESC`,
    );
    const row: Record<string, unknown> = totals[0] ?? {};
    return {
      blockedInstalls: this.num(row.blockedInstalls),
      blockedClicks: this.num(row.blockedClicks),
      blockedInAppEvents: this.num(row.blockedInAppEvents),
      blockedReasons,
      rejectedReasons,
      blockedByMediaSource,
      blockedByCampaign,
    };
  }

  async getSemanticSeedEvents(projectId: string, filters: Pick<AppsFlyerEventFilters, 'importId' | 'reportType'> = {}) {
    const clauses = [`project_id = ${this.client.escape(projectId)}`, "source = 'APPSFLYER'"];
    if (filters.importId) clauses.push(`import_id = ${this.client.escape(filters.importId)}`);
    if (filters.reportType) clauses.push(`report_type = ${this.client.escape(filters.reportType)}`);

    return this.client.query(
      `SELECT
        coalesce(media_source, 'unknown') AS mediaSource,
        coalesce(campaign_name, 'unknown') AS campaignName,
        campaign_id AS campaignId,
        event_name AS eventName,
        canonical_event_name AS canonicalEventName,
        count() AS events
       FROM marketing.marketing_events FINAL
       WHERE ${clauses.join(' AND ')}
       GROUP BY media_source, campaign_name, campaign_id, event_name, canonical_event_name
       ORDER BY events DESC
       LIMIT 500`,
    );
  }

  private where(projectId: string, filters: AppsFlyerEventFilters): string {
    const clauses = [`project_id = ${this.client.escape(projectId)}`, "source = 'APPSFLYER'"];
    if (filters.from) clauses.push(`event_date >= toDate(${this.client.escape(filters.from)})`);
    if (filters.to) clauses.push(`event_date <= toDate(${this.client.escape(filters.to)})`);
    if (filters.importId) clauses.push(`import_id = ${this.client.escape(filters.importId)}`);
    if (filters.reportType) clauses.push(`report_type = ${this.client.escape(filters.reportType)}`);
    if (filters.mediaSource) clauses.push(`media_source = ${this.client.escape(filters.mediaSource)}`);
    if (filters.campaignName) clauses.push(`campaign_name = ${this.client.escape(filters.campaignName)}`);
    if (filters.canonicalEventName) clauses.push(`canonical_event_name = ${this.client.escape(filters.canonicalEventName)}`);
    return clauses.join(' AND ');
  }

  private num(value: unknown): number { return Number(value ?? 0); }
}
