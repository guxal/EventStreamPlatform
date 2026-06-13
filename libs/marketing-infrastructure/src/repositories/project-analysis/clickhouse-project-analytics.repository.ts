import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CanonicalEventType, ReportType, type ProjectGoldSummary } from '@metrics-platform/marketing-shared';
import { getClickHouseClient, isClickHouseEnabled } from '../../database/clickhouse-client.factory';
import { ClickHouseQueryClient } from '../appsflyer/clickhouse-query.util';

export type ProjectAnalyticsFilters = { source: string; dateRangeStart?: string | null; dateRangeEnd?: string | null };

@Injectable()
export class ClickHouseProjectAnalyticsRepository {
  private readonly client = new ClickHouseQueryClient();

  async getReportTypeCounts(projectId: string, filters: ProjectAnalyticsFilters): Promise<Array<{ reportType: string; events: number }>> {
    const rows = await this.client.query<Record<string, unknown>>(
      `SELECT report_type AS reportType, count() AS events
       FROM marketing.marketing_events FINAL
       WHERE ${this.where(projectId, filters)}
       GROUP BY report_type`,
    );
    return rows.map((row) => ({ reportType: String(row.reportType), events: this.num(row.events) }));
  }

  async getPeriodFunnel(projectId: string, filters: ProjectAnalyticsFilters): Promise<Record<string, number | string>> {
    const rows = await this.client.query<Record<string, unknown>>(
      `SELECT
        count() AS totalEvents,
        min(event_date) AS periodStart,
        max(event_date) AS periodEnd,
        countIf(is_blocked = 0) AS totalValidEvents,
        countIf(is_blocked = 1) AS totalBlockedEvents,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.INSTALL}') AS installs,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.INSTALL}') AS installUsers,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.REGISTRATION}') AS registrationUsers,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS depositUsers,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS depositEvents,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS ftdUsers,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS ftdEvents,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.LOGIN}') AS loginUsers,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.ENGAGEMENT}') AS engagementEvents,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS depositAmount,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.BET_PLACED}') AS betPlacedAmount,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.BET_SETTLEMENT}') AS betSettlementAmount,
        countIf(is_blocked = 0 AND coalesce(customer_user_id, '') != '') AS customerIdRows,
        countIf(is_blocked = 0 AND coalesce(customer_user_id, '') = '' AND coalesce(appsflyer_id, '') != '') AS appsflyerIdRows,
        countIf(is_blocked = 0 AND coalesce(customer_user_id, '') = '' AND coalesce(appsflyer_id, '') = '') AS missingIdentityRows,
        countIf(is_blocked = 0 AND event_revenue IS NOT NULL AND event_revenue != 0) AS nonEmptyEventRevenueRows,
        countIf(is_blocked = 0 AND event_amount IS NOT NULL AND event_amount != 0) AS nonEmptyEventAmountRows,
        countIf(is_retargeting = 1) AS retargetingEvents
       FROM marketing.marketing_events FINAL
       WHERE ${this.where(projectId, filters)}`,
    );
    return this.numericRow(rows[0] ?? {});
  }

  async getCohortFunnel(projectId: string, filters: ProjectAnalyticsFilters, windows = [0, 1, 3, 7, 30]): Promise<Record<string, number>> {
    const selectWindows = windows.flatMap((days) => [
      `uniqExactIf(events.user_key, events.canonical_event_name = '${CanonicalEventType.REGISTRATION}' AND events.event_time <= installs.install_time + INTERVAL ${days} DAY) AS d${days}RegisterUsers`,
      `uniqExactIf(events.user_key, events.canonical_event_name = '${CanonicalEventType.DEPOSIT}' AND events.event_time <= installs.install_time + INTERVAL ${days} DAY) AS d${days}DepositUsers`,
      `uniqExactIf(events.user_key, events.canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}' AND events.event_time <= installs.install_time + INTERVAL ${days} DAY) AS d${days}FtdUsers`,
      `sumIf(toFloat64OrZero(toString(events.event_amount)), events.canonical_event_name = '${CanonicalEventType.DEPOSIT}' AND events.event_time <= installs.install_time + INTERVAL ${days} DAY) AS d${days}DepositAmount`,
    ]).join(',\n        ');
    const rows = await this.client.query<Record<string, unknown>>(
      `WITH installs AS (
         SELECT coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, '')) AS user_key, min(coalesce(install_time, event_time)) AS install_time
         FROM marketing.marketing_events FINAL
         WHERE ${this.where(projectId, filters)} AND is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.INSTALL}' AND coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, '')) != ''
         GROUP BY user_key
       ), events AS (
         SELECT coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, '')) AS user_key, event_time, canonical_event_name, event_amount
         FROM marketing.marketing_events FINAL
         WHERE project_id = ${this.client.escape(projectId)} AND source = ${this.client.escape(filters.source.toUpperCase())} AND is_blocked = 0
           AND coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, '')) != ''
           AND canonical_event_name IN ('${CanonicalEventType.REGISTRATION}','${CanonicalEventType.DEPOSIT}','${CanonicalEventType.FIRST_DEPOSIT}','${CanonicalEventType.BET_PLACED}','${CanonicalEventType.BET_SETTLEMENT}','${CanonicalEventType.LOGIN}','${CanonicalEventType.ENGAGEMENT}')
       )
       SELECT count() AS cohortUsers, uniqExact(events.user_key) AS matchedUsers, ${selectWindows}
       FROM installs LEFT JOIN events ON installs.user_key = events.user_key AND events.event_time >= installs.install_time`,
    );
    return this.numericRow(rows[0] ?? {}) as Record<string, number>;
  }


  async getCampaignMetrics(projectId: string, filters: ProjectAnalyticsFilters): Promise<Record<string, number | string>[]> {
    const rows = await this.client.query<Record<string, unknown>>(
      `SELECT
        coalesce(nullIf(campaign_name, ''), nullIf(campaign_id, ''), 'unknown') AS campaign,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.INSTALL}') AS installs,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.REGISTRATION}') AS registerUsers,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS depositUsers,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS ftdUsers,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS depositAmount,
        countIf(is_blocked = 1) AS blockedEvents,
        countIf(is_blocked = 0) AS eventVolume
       FROM marketing.marketing_events FINAL WHERE ${this.where(projectId, filters)} GROUP BY campaign ORDER BY ftdUsers DESC, depositUsers DESC LIMIT 500`,
    );
    return rows.map((row) => this.numericRow(row));
  }

  async getBlockedTraffic(projectId: string, filters: ProjectAnalyticsFilters): Promise<{ totals: Record<string, number>; reasons: Array<{ reason: string; count: number }>; mediaSources: Array<{ mediaSource: string; count: number }> }> {
    const totals = await this.client.query<Record<string, unknown>>(
      `SELECT
        countIf(is_blocked = 1 AND canonical_event_name = '${CanonicalEventType.INSTALL}') AS blockedInstalls,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.INSTALL}') AS acceptedInstalls,
        countIf(is_blocked = 1 AND report_type = '${ReportType.BLOCKED_IN_APP_EVENTS}') AS blockedInAppEvents,
        countIf(is_blocked = 0 AND report_type IN ('${ReportType.IN_APP_EVENTS}','${ReportType.NON_ORGANIC_IN_APP_EVENTS}','${ReportType.IN_APP_EVENTS_POSTBACKS}')) AS acceptedInAppEvents
       FROM marketing.marketing_events FINAL WHERE ${this.where(projectId, filters)}`,
    );
    const reasons = await this.client.query<Record<string, unknown>>(
      `SELECT coalesce(nullIf(blocked_reason, ''), nullIf(rejected_reason, ''), 'unknown') AS reason, count() AS count
       FROM marketing.marketing_events FINAL WHERE ${this.where(projectId, filters)} AND is_blocked = 1 GROUP BY reason ORDER BY count DESC LIMIT 50`,
    );
    const mediaSources = await this.client.query<Record<string, unknown>>(
      `SELECT coalesce(nullIf(media_source, ''), 'unknown') AS mediaSource, count() AS count
       FROM marketing.marketing_events FINAL WHERE ${this.where(projectId, filters)} AND is_blocked = 1 GROUP BY mediaSource ORDER BY count DESC LIMIT 50`,
    );
    return { totals: this.numericRow(totals[0] ?? {}) as Record<string, number>, reasons: reasons.map((row) => ({ reason: String(row.reason), count: this.num(row.count) })), mediaSources: mediaSources.map((row) => ({ mediaSource: String(row.mediaSource), count: this.num(row.count) })) };
  }

  async getMediaSourceQuality(projectId: string, filters: ProjectAnalyticsFilters): Promise<Record<string, number | string>[]> {
    const rows = await this.client.query<Record<string, unknown>>(
      `SELECT
        coalesce(nullIf(media_source, ''), 'unknown') AS mediaSource,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.INSTALL}') AS installs,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.REGISTRATION}') AS registerUsers,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS depositUsers,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS ftdUsers,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS depositAmount,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.BET_PLACED}') AS betPlacedAmount,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.BET_SETTLEMENT}') AS betSettlementAmount,
        countIf(is_blocked = 1 AND canonical_event_name = '${CanonicalEventType.INSTALL}') AS blockedInstalls,
        countIf(is_blocked = 1) AS blockedEvents,
        countIf(is_blocked = 0) AS eventVolume,
        countIf(is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.REGISTRATION}','${CanonicalEventType.DEPOSIT}','${CanonicalEventType.FIRST_DEPOSIT}')) AS conversionEventVolume,
        countIf(is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.LOGIN}','${CanonicalEventType.ENGAGEMENT}')) AS engagementEventVolume
       FROM marketing.marketing_events FINAL WHERE ${this.where(projectId, filters)} GROUP BY mediaSource`,
    );
    return rows.map((row) => this.numericRow(row));
  }

  async replaceProjectMetricSnapshots(summary: ProjectGoldSummary): Promise<void> {
    if (!isClickHouseEnabled()) return;
    const client = getClickHouseClient();
    if (!client) return;
    const periodStart = summary.dateRangeStart ?? summary.dataAvailability.dateRangeStart ?? summary.generatedAt.slice(0, 10);
    const periodEnd = summary.dateRangeEnd ?? summary.dataAvailability.dateRangeEnd ?? periodStart;
    await client.command({ query: `ALTER TABLE marketing.marketing_metric_snapshots DELETE WHERE project_id = ${this.client.escape(summary.projectId)} AND scope_type = 'PROJECT' AND source = ${this.client.escape(summary.source)} AND period_start = toDate(${this.client.escape(periodStart)}) AND period_end = toDate(${this.client.escape(periodEnd)})` });
    const rows: Record<string, unknown>[] = [this.snapshotRow(summary, 'project', summary.projectId, summary.kpis)];
    for (const media of summary.mediaSourceQuality.rows) rows.push(this.snapshotRow(summary, 'media_source', media.mediaSource, media));
    for (const campaign of summary.campaignMetrics ?? []) rows.push(this.snapshotRow(summary, 'campaign', String(campaign.campaign ?? 'unknown'), campaign));
    await client.insert({ table: 'marketing.marketing_metric_snapshots', values: rows, format: 'JSONEachRow' });
  }

  async getLatestProjectSnapshot(projectId: string, filters: ProjectAnalyticsFilters): Promise<Record<string, unknown> | null> {
    const extra = [`scope_type = 'PROJECT'`, `dimension_type = 'project'`];
    if (filters.dateRangeStart) extra.push(`period_start = toDate(${this.client.escape(filters.dateRangeStart)})`);
    if (filters.dateRangeEnd) extra.push(`period_end = toDate(${this.client.escape(filters.dateRangeEnd)})`);
    const rows = await this.client.query<Record<string, unknown>>(
      `SELECT * FROM marketing.marketing_metric_snapshots FINAL WHERE project_id = ${this.client.escape(projectId)} AND source = ${this.client.escape(filters.source)} AND ${extra.join(' AND ')} ORDER BY created_at DESC LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  private snapshotRow(summary: ProjectGoldSummary, dimensionType: string, dimensionValue: string, metrics: Record<string, unknown>) {
    const periodStart = summary.dateRangeStart ?? summary.dataAvailability.dateRangeStart ?? summary.generatedAt.slice(0, 10);
    const periodEnd = summary.dateRangeEnd ?? summary.dataAvailability.dateRangeEnd ?? periodStart;
    return {
      snapshot_id: randomUUID(), project_id: summary.projectId, entity_id: dimensionValue || summary.projectId, entity_type: dimensionType === 'project' ? 'account' : dimensionType,
      as_of_date: periodEnd, period_start: periodStart, period_end: periodEnd, conversions: Number(metrics.ftd_users ?? metrics.ftdUsers ?? 0), conversion_value: Number(metrics.deposit_amount ?? metrics.depositAmount ?? 0),
      context_metadata: JSON.stringify({ ...metrics, projectGoldSummary: dimensionType === 'project' ? summary : undefined }), source_run_id: summary.analysisRunId,
      scope_type: 'PROJECT', scope_id: summary.projectId, analysis_run_id: summary.analysisRunId, source: summary.source, report_type: null, date_range_start: periodStart, date_range_end: periodEnd, dimension_type: dimensionType, dimension_value: dimensionValue,
    };
  }

  private where(projectId: string, filters: ProjectAnalyticsFilters): string {
    const clauses = [`project_id = ${this.client.escape(projectId)}`, `source = ${this.client.escape(filters.source.toUpperCase())}`];
    if (filters.dateRangeStart) clauses.push(`event_date >= toDate(${this.client.escape(filters.dateRangeStart)})`);
    if (filters.dateRangeEnd) clauses.push(`event_date <= toDate(${this.client.escape(filters.dateRangeEnd)})`);
    return clauses.join(' AND ');
  }

  private numericRow(row: Record<string, unknown>): Record<string, number | string> {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value ?? '')) ? this.num(value) : String(value ?? '')]));
  }

  private num(value: unknown): number { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
}
