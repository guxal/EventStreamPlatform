import { Injectable } from '@nestjs/common';
import { CanonicalEventType, DataSource, ReportType } from '@metrics-platform/marketing-shared';

export type BuiltInSourceMapping = {
  source: DataSource;
  reportType: ReportType;
  columnMapping: Record<string, string>;
  eventMapping: Record<string, string>;
  identityStrategy: string[];
  sensitiveFields: string[];
  currency: string | null;
  timezone: string | null;
  kpiRules: Record<string, unknown>;
  dataQualityRules: Record<string, unknown>;
};

const APPSFLYER_REPORT_TYPES = new Set<ReportType>([
  ReportType.INSTALLS,
  ReportType.IN_APP_EVENTS,
  ReportType.NON_ORGANIC_IN_APP_EVENTS,
  ReportType.IN_APP_EVENTS_POSTBACKS,
  ReportType.CONVERSIONS,
  ReportType.BLOCKED_INSTALLS,
  ReportType.BLOCKED_CLICKS,
  ReportType.BLOCKED_IN_APP_EVENTS,
  ReportType.AD_REVENUE,
  ReportType.UNINSTALLS,
]);

const APPSFLYER_COLUMN_MAPPING: Record<string, string> = {
  'Event Name': 'event_name',
  'Event Time': 'event_time',
  'Install Time': 'install_time',
  'AppsFlyer ID': 'appsflyer_id',
  'Customer User ID': 'customer_user_id',
  'Advertising ID': 'advertising_id',
  IDFA: 'idfa',
  IDFV: 'idfv',
  'Android ID': 'android_id',
  'Media Source': 'media_source',
  Partner: 'partner',
  Channel: 'channel',
  Campaign: 'campaign_name',
  'Campaign ID': 'campaign_id',
  Adset: 'adset_name',
  'Adset ID': 'adset_id',
  Ad: 'ad_name',
  'Ad ID': 'ad_id',
  'Country Code': 'country_code',
  Region: 'region',
  State: 'state',
  City: 'city',
  Platform: 'platform',
  'Event Value': 'event_value',
  'Event Revenue': 'event_revenue',
  'Event Revenue Currency': 'event_revenue_currency',
  'Cost Value': 'cost_value',
  'Cost Currency': 'cost_currency',
  'Is Retargeting': 'is_retargeting',
  'Retargeting Conversion Type': 'retargeting_conversion_type',
  'Blocked Reason': 'blocked_reason',
  'Rejected Reason': 'rejected_reason',
};

const APPSFLYER_EVENT_MAPPING: Record<string, string> = {
  install: CanonicalEventType.INSTALL,
  reinstall: CanonicalEventType.REINSTALL,
  register_success: CanonicalEventType.REGISTRATION,
  user_registration_started: CanonicalEventType.REGISTRATION_STARTED,
  login_success: CanonicalEventType.LOGIN,
  login_clicked: CanonicalEventType.LOGIN,
  login_submitted: CanonicalEventType.LOGIN,
  deposit_clicked: CanonicalEventType.DEPOSIT_INTENT,
  deposit_success: CanonicalEventType.DEPOSIT,
  first_deposit_success: CanonicalEventType.FIRST_DEPOSIT,
  casino_bet_placed: CanonicalEventType.BET_PLACED,
  casino_bet_settlement_success: CanonicalEventType.BET_SETTLEMENT,
  withdraw: CanonicalEventType.WITHDRAW_INTENT,
  withdraw_success: CanonicalEventType.WITHDRAW,
  carousel_banner_viewed: CanonicalEventType.ENGAGEMENT,
  carousel_banner_clicked: CanonicalEventType.ENGAGEMENT,
  casino_game_open: CanonicalEventType.ENGAGEMENT,
  casino_game_open_live: CanonicalEventType.ENGAGEMENT,
  home_menu_clicked: CanonicalEventType.ENGAGEMENT,
  push_consent_opt_in: CanonicalEventType.CONSENT,
  push_consent_opt_out: CanonicalEventType.CONSENT,
  home_joinnow_clicked: CanonicalEventType.REGISTRATION_INTENT,
  joinnow_submitted: CanonicalEventType.REGISTRATION_STEP,
  register_submitted: CanonicalEventType.REGISTRATION_STEP,
  user_registration_step1_submitted: CanonicalEventType.REGISTRATION_STEP,
  user_registration_tnc_confirmed: CanonicalEventType.REGISTRATION_STEP,
  register_error: CanonicalEventType.REGISTRATION_ERROR,
  user_registration_failed: CanonicalEventType.REGISTRATION_ERROR,
  joinnow_exit: CanonicalEventType.REGISTRATION_DROP_OFF,
  customer_service_interaction: CanonicalEventType.SUPPORT_INTERACTION,
  first_casino_bet_placed: CanonicalEventType.FIRST_BET,
  first_withdraw_success: CanonicalEventType.FIRST_WITHDRAW,
  click: CanonicalEventType.CLICK,
  're-attribution': CanonicalEventType.REATTRIBUTION,
};

@Injectable()
export class BuiltInSourceMappingRegistry {
  get(source: string, reportType: string): BuiltInSourceMapping | null {
    if (source === DataSource.APPSFLYER && APPSFLYER_REPORT_TYPES.has(reportType as ReportType)) {
      return {
        source: DataSource.APPSFLYER,
        reportType: reportType as ReportType,
        columnMapping: { ...APPSFLYER_COLUMN_MAPPING },
        eventMapping: { ...APPSFLYER_EVENT_MAPPING },
        identityStrategy: ['customer_user_id', 'appsflyer_id', 'advertising_id', 'idfa', 'idfv', 'android_id'],
        sensitiveFields: ['IP', 'Advertising ID', 'AppsFlyer ID', 'Customer User ID', 'Original URL', 'User Agent', 'IDFA', 'IDFV', 'Android ID'],
        currency: null,
        timezone: 'UTC',
        kpiRules: {},
        dataQualityRules: {},
      };
    }

    // TODO: Add Google Ads default mappings when the Google Ads processing slice is implemented.
    return null;
  }

  materializeForHeaders(mapping: BuiltInSourceMapping, headers: string[]): BuiltInSourceMapping {
    const headerIndex = new Map(headers.map((header) => [this.normalize(header), header]));
    const columnMapping: Record<string, string> = {};
    for (const [defaultHeader, canonicalField] of Object.entries(mapping.columnMapping)) {
      const actualHeader = headerIndex.get(this.normalize(defaultHeader));
      if (actualHeader) columnMapping[actualHeader] = canonicalField;
    }
    return { ...mapping, columnMapping };
  }

  isCompatible(mapping: BuiltInSourceMapping, headers: string[]): boolean {
    return Object.keys(this.materializeForHeaders(mapping, headers).columnMapping).length > 0;
  }

  private normalize(header: string): string {
    return header.trim().toLowerCase().replace(/[\s_-]+/g, '').replace(/[^a-z0-9]/g, '');
  }
}
