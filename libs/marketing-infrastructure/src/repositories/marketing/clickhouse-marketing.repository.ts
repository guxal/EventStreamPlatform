import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NormalizedAppsFlyerEvent } from '@metrics-platform/marketing-shared';
import { getClickHouseClient, isClickHouseEnabled } from '../../database/clickhouse-client.factory';

@Injectable()
export class ClickHouseMarketingRepository {
  async insertMarketingEvents(events: NormalizedAppsFlyerEvent[]): Promise<void> {
    if (events.length === 0) return;
    const rows = events.map((event) => ({
      project_id: event.projectId,
      integration_id: event.integrationId,
      import_id: event.importId,
      raw_file_id: event.rawFileId,
      source: event.source,
      report_type: event.reportType,
      event_name: event.eventName,
      canonical_event_name: event.canonicalEventName,
      event_time: event.eventTime,
      event_date: event.eventDate,
      install_time: event.installTime,
      media_source: event.mediaSource,
      campaign_name: event.campaignName,
      campaign_id: event.campaignId,
      adset_name: event.adsetName,
      adset_id: event.adsetId,
      ad_name: event.adName,
      ad_id: event.adId,
      country_code: event.countryCode,
      platform: event.platform,
      appsflyer_id: event.appsflyerId,
      customer_user_id: event.customerUserId,
      event_amount: event.eventAmount,
      event_revenue: event.eventRevenue,
      currency: event.currency,
      is_retargeting: event.isRetargeting ? 1 : 0,
      is_blocked: event.isBlocked ? 1 : 0,
      blocked_reason: event.blockedReason,
      rejected_reason: event.rejectedReason,
      raw_payload: JSON.stringify(event.rawPayload),
      row_hash: event.rowHash,
    }));
    await this.insertJsonEachRow('marketing.marketing_events', rows, 1000);
  }

  async insertMetricSnapshot(projectId: string, importId: string, kpis: Record<string, unknown>): Promise<void> {
    await this.insertJsonEachRow('marketing.marketing_metric_snapshots', [{
      snapshot_id: randomUUID(),
      project_id: projectId,
      entity_id: projectId,
      entity_type: 'account',
      as_of_date: new Date().toISOString().slice(0, 10),
      period_start: new Date().toISOString().slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
      context_metadata: JSON.stringify(kpis),
      source_run_id: importId,
    }]);
  }

  private async insertJsonEachRow(table: string, rows: Record<string, unknown>[], batchSize = 1000): Promise<void> {
    if (!isClickHouseEnabled() || rows.length === 0) return;

    const client = getClickHouseClient();
    if (!client) return;

    for (let index = 0; index < rows.length; index += batchSize) {
      const batch = rows.slice(index, index + batchSize);
      await client.insert({
        table,
        values: batch,
        format: 'JSONEachRow',
      });
    }
  }
}
