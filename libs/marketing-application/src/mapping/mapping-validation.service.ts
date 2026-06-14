import { Injectable } from '@nestjs/common';
import { DataSource, MappingProfileStatus, ReportType, type MappingValidationResult, type ProjectSourceMapping } from '@metrics-platform/marketing-shared';

const KNOWN_SOURCES = new Set<string>([DataSource.APPSFLYER, DataSource.GOOGLE_ADS]);
const EVENT_REPORTS = new Set<string>([ReportType.IN_APP_EVENTS, ReportType.NON_ORGANIC_IN_APP_EVENTS, ReportType.IN_APP_EVENTS_POSTBACKS, ReportType.BLOCKED_IN_APP_EVENTS]);
const ACTIVE_STATUSES = new Set<string>([MappingProfileStatus.CONFIRMED, MappingProfileStatus.ACTIVE]);

@Injectable()
export class MappingValidationService {
  validate(mapping: Pick<ProjectSourceMapping, 'source' | 'reportType' | 'status' | 'columnMapping' | 'eventMapping' | 'identityStrategy' | 'sensitiveFields' | 'currency' | 'timezone'>): MappingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const source = String(mapping.source);
    const reportType = String(mapping.reportType);
    const canonical = new Set(Object.values(mapping.columnMapping ?? {}));

    if (!KNOWN_SOURCES.has(source)) errors.push(`Unknown source ${source}`);
    if (reportType === ReportType.UNKNOWN) errors.push('Unknown reportType');
    if (!ACTIVE_STATUSES.has(String(mapping.status))) errors.push('Mapping status must be CONFIRMED or ACTIVE');
    if (!Array.isArray(mapping.identityStrategy) || mapping.identityStrategy.length === 0) errors.push('identityStrategy is required');
    if (!Array.isArray(mapping.sensitiveFields) || mapping.sensitiveFields.length === 0) warnings.push('No sensitive fields identified');
    if (!mapping.currency) warnings.push('currency is not set');
    if (!mapping.timezone) warnings.push('timezone is not set');

    const values = Object.values(mapping.columnMapping ?? {});
    const duplicates = values.filter((value, i) => values.indexOf(value) !== i);
    if (duplicates.length) errors.push(`Duplicate canonical mappings: ${[...new Set(duplicates)].join(', ')}`);

    if (source === DataSource.APPSFLYER && reportType === ReportType.INSTALLS) {
      if (!canonical.has('event_name') && !canonical.has('install_time')) errors.push('AppsFlyer installs require event_name or install_time');
      if (!canonical.has('appsflyer_id') && !canonical.has('advertising_id')) errors.push('AppsFlyer installs require appsflyer_id or advertising_id');
      if (!canonical.has('media_source')) warnings.push('media_source is recommended');
      if (!canonical.has('campaign_name') && !canonical.has('campaign_id')) warnings.push('campaign is recommended');
    }

    if (source === DataSource.APPSFLYER && EVENT_REPORTS.has(reportType)) {
      if (!canonical.has('event_name')) errors.push('AppsFlyer event reports require event_name');
      if (!canonical.has('event_time')) errors.push('AppsFlyer event reports require event_time');
      if (!canonical.has('appsflyer_id') && !canonical.has('customer_user_id') && !canonical.has('advertising_id')) errors.push('AppsFlyer event reports require appsflyer_id, customer_user_id, or advertising_id');
      if (!mapping.eventMapping || Object.keys(mapping.eventMapping).length === 0) errors.push('eventMapping is required for AppsFlyer event reports');
    }

    if (source === DataSource.GOOGLE_ADS && reportType === ReportType.CAMPAIGNS) {
      for (const f of ['impressions', 'clicks', 'cost']) if (!canonical.has(f)) errors.push(`Google Ads campaigns require ${f}`);
      if (!canonical.has('campaign') && !canonical.has('campaign_id')) errors.push('Google Ads campaigns require campaign or campaign_id');
    }

    if (source === DataSource.GOOGLE_ADS && [ReportType.KEYWORDS, ReportType.SEARCH_TERMS].includes(reportType as ReportType)) {
      for (const f of ['impressions', 'clicks', 'cost']) if (!canonical.has(f)) errors.push(`Google Ads ${reportType} require ${f}`);
      if (!canonical.has('campaign') && !canonical.has('campaign_id')) errors.push(`Google Ads ${reportType} require campaign or campaign_id`);
      if (!canonical.has('keyword') && !canonical.has('search_term')) errors.push(`Google Ads ${reportType} require keyword or search_term`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
