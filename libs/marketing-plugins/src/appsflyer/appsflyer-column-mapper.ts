import { Injectable } from '@nestjs/common';
import type { ProjectSourceMapping } from '@metrics-platform/marketing-shared';
import type { MappedAppsFlyerRow, ParsedCsvRow } from './appsflyer.types';

const COLUMN_ALIASES: Record<string, string[]> = {
  appsflyerId: ['appsflyer id', 'apps flyer id', 'af id'],
  customerUserId: ['customer user id', 'customer_user_id', 'cuid'],
  advertisingId: ['advertising id', 'advertising_id', 'idfa', 'gaid'],
  eventName: ['event name', 'event_name'],
  eventTime: ['event time', 'event_time'],
  installTime: ['install time', 'install_time'],
  mediaSource: ['media source', 'media_source', 'media-source', 'pid'],
  partner: ['partner', 'af partner'],
  channel: ['channel'],
  campaignName: ['campaign', 'campaign name', 'campaign_name', 'c'],
  campaignId: ['campaign id', 'campaign_id', 'af_c_id'],
  adsetName: ['adset', 'adset name', 'adset_name', 'ad set', 'ad set name'],
  adsetId: ['adset id', 'adset_id', 'ad set id', 'af_adset_id'],
  adName: ['ad', 'ad name', 'ad_name'],
  adId: ['ad id', 'ad_id', 'af_ad_id'],
  countryCode: ['country code', 'country_code', 'country'],
  region: ['region'],
  state: ['state'],
  city: ['city'],
  platform: ['platform', 'os'],
  eventValue: ['event value', 'event_value'],
  eventRevenue: ['event revenue', 'event_revenue', 'revenue'],
  currency: ['event revenue currency', 'event_revenue_currency', 'currency'],
  blockedReason: ['blocked reason', 'blocked_reason'],
  rejectedReason: ['rejected reason', 'rejected_reason'],
  attributedTouchType: ['attributed touch type', 'attributed_touch_type'],
  attributedTouchTime: ['attributed touch time', 'attributed_touch_time'],
  isRetargeting: ['is retargeting', 'is_retargeting'],
  retargetingConversionType: ['retargeting conversion type', 'retargeting_conversion_type'],
};

@Injectable()
export class AppsFlyerColumnMapper {
  map(row: ParsedCsvRow, mappingProfile?: ProjectSourceMapping | null): MappedAppsFlyerRow {
    const normalizedIndex = new Map<string, string>();
    for (const key of Object.keys(row.raw)) normalizedIndex.set(this.normalizeHeader(key), key);

    const canonical: Record<string, string | undefined> = {};
    for (const [sourceHeader, canonicalField] of Object.entries(mappingProfile?.columnMapping ?? {})) {
      const actualKey = normalizedIndex.get(this.normalizeHeader(sourceHeader));
      if (actualKey) canonical[this.toInternalField(String(canonicalField))] = this.emptyToUndefined(row.raw[actualKey]);
    }
    for (const [target, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (canonical[target] !== undefined) continue;
      const actualKey = aliases.map((alias) => normalizedIndex.get(this.normalizeHeader(alias))).find(Boolean);
      canonical[target] = actualKey ? this.emptyToUndefined(row.raw[actualKey]) : undefined;
    }

    return { ...row, canonical };
  }

  normalizeHeader(header: string): string {
    return header.trim().toLowerCase().replace(/[\s_-]+/g, '').replace(/[^a-z0-9]/g, '');
  }

  private toInternalField(canonicalField: string): string {
    return canonicalField.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  }

  private emptyToUndefined(value: string | undefined): string | undefined {
    const trimmed = String(value ?? '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
