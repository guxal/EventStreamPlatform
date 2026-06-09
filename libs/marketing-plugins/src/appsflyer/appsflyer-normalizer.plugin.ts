import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { CanonicalEventType, DataSource, ReportType, type NormalizedAppsFlyerEvent } from '@metrics-platform/marketing-shared';
import { AppsFlyerEventDictionaryPlugin } from './appsflyer-event-dictionary.plugin';
import type { AppsFlyerProcessingContext, ParsedEventValueRow } from './appsflyer.types';

@Injectable()
export class AppsFlyerNormalizerPlugin {
  constructor(private readonly dictionary = new AppsFlyerEventDictionaryPlugin()) {}

  normalize(context: AppsFlyerProcessingContext, row: ParsedEventValueRow): NormalizedAppsFlyerEvent {
    const c = row.canonical;
    const eventName = c.eventName ?? this.defaultEventName(context.reportType);
    const canonicalEventName = this.canonicalEventName(context.reportType, eventName);
    const eventTime = this.parseDate(c.eventTime) ?? this.parseDate(c.installTime) ?? new Date(0);
    const installTime = this.parseDate(c.installTime);
    const eventRevenue = this.parseNumber(c.eventRevenue);
    const isBlocked = context.reportType.startsWith('blocked_') || Boolean(c.blockedReason || c.rejectedReason);
    const rawPayload = { ...row.raw, eventValueJson: row.eventValueJson ?? undefined, rowWarnings: row.warnings };
    const rowHash = createHash('sha256')
      .update(JSON.stringify({ importId: context.importId, rowNumber: row.rowNumber, raw: row.raw }))
      .digest('hex');

    return {
      projectId: context.projectId,
      integrationId: context.integrationId ?? null,
      importId: context.importId,
      rawFileId: context.rawFileId,
      source: DataSource.APPSFLYER,
      reportType: context.reportType,
      eventName,
      canonicalEventName,
      eventTime: eventTime.toISOString(),
      eventDate: eventTime.toISOString().slice(0, 10),
      installTime: installTime?.toISOString() ?? null,
      attributedTouchType: c.attributedTouchType ?? null,
      attributedTouchTime: this.parseDate(c.attributedTouchTime)?.toISOString() ?? null,
      mediaSource: c.mediaSource ?? null,
      partner: c.partner ?? null,
      channel: c.channel ?? null,
      campaignName: c.campaignName ?? null,
      campaignId: c.campaignId ?? null,
      adsetName: c.adsetName ?? null,
      adsetId: c.adsetId ?? null,
      adName: c.adName ?? null,
      adId: c.adId ?? null,
      countryCode: c.countryCode ?? null,
      region: c.region ?? null,
      state: c.state ?? null,
      city: c.city ?? null,
      platform: c.platform ?? null,
      appsflyerId: c.appsflyerId ?? null,
      customerUserId: c.customerUserId ?? null,
      advertisingId: c.advertisingId ?? null,
      isRetargeting: this.parseBoolean(c.isRetargeting),
      retargetingConversionType: c.retargetingConversionType ?? null,
      eventAmount: row.eventAmount ?? null,
      eventRevenue,
      currency: c.currency ?? null,
      isBlocked,
      blockedReason: c.blockedReason ?? null,
      rejectedReason: c.rejectedReason ?? null,
      rawPayload,
      rowHash,
    };
  }

  private canonicalEventName(reportType: ReportType, eventName: string): CanonicalEventType {
    if (reportType === ReportType.INSTALLS || reportType === ReportType.BLOCKED_INSTALLS) {
      return eventName.toLowerCase().includes('reinstall') ? CanonicalEventType.REINSTALL : CanonicalEventType.INSTALL;
    }
    if (reportType === ReportType.UNINSTALLS) return CanonicalEventType.UNINSTALL;
    if (reportType === ReportType.BLOCKED_CLICKS) return CanonicalEventType.UNKNOWN;
    return this.dictionary.map(eventName);
  }

  private defaultEventName(reportType: ReportType): string {
    if (reportType === ReportType.INSTALLS || reportType === ReportType.BLOCKED_INSTALLS) return 'install';
    if (reportType === ReportType.UNINSTALLS) return 'uninstall';
    return 'unknown';
  }

  private parseDate(value: string | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseNumber(value: string | undefined): number | null {
    if (value === undefined || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseBoolean(value: string | undefined): boolean {
    return ['true', '1', 'yes', 'y'].includes(String(value ?? '').trim().toLowerCase());
  }
}
