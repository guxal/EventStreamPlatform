import { Injectable } from '@nestjs/common';
import { DataSource, ReportType, type SchemaAssistantRequest, type SchemaAssistantResponse } from '@metrics-platform/marketing-shared';

const SENSITIVE_HEADER_PATTERNS = [/\bip\b/i, /advertising id/i, /appsflyer id/i, /apps flyer id/i, /customer user id/i, /android id/i, /\bidfa\b/i, /\bidfv\b/i, /\bimei\b/i, /original url/i, /user agent/i, /email/i, /phone/i, /token/i];
const CANONICAL_ALIASES: Record<string, string> = {
  'event name': 'event_name', 'event time': 'event_time', 'install time': 'install_time', 'appsflyer id': 'appsflyer_id', 'apps flyer id': 'appsflyer_id', 'customer user id': 'customer_user_id', 'advertising id': 'advertising_id', 'media source': 'media_source', campaign: 'campaign_name', 'campaign name': 'campaign_name', 'campaign id': 'campaign_id', adset: 'adset_name', 'adset id': 'adset_id', ad: 'ad_name', 'ad id': 'ad_id', 'event value': 'event_value', 'event revenue': 'event_revenue', 'event revenue currency': 'event_revenue_currency', 'cost value': 'cost_value', 'cost currency': 'cost_currency', impressions: 'impressions', clicks: 'clicks', cost: 'cost', conversions: 'conversions', 'conversion value': 'conversion_value', keyword: 'keyword', 'search term': 'search_term'
};

@Injectable()
export class AiSchemaAssistantService {
  async suggest(input: SchemaAssistantRequest): Promise<SchemaAssistantResponse> {
    const sanitizedSampleRows = this.sanitizeSampleRows(input.headers, input.sampleRows);
    const columnMapping = this.suggestColumnMapping(input.headers);
    const sensitiveFields = input.headers.filter((h) => this.isSensitiveHeader(h));
    const eventMapping: Record<string, string> = {};
    if (input.source === DataSource.APPSFLYER && [ReportType.INSTALLS, ReportType.IN_APP_EVENTS, ReportType.NON_ORGANIC_IN_APP_EVENTS].includes(input.reportType as ReportType)) {
      eventMapping.install = 'INSTALL';
      eventMapping.deposit_success = 'DEPOSIT';
      eventMapping.first_deposit_success = 'FIRST_DEPOSIT';
      eventMapping.register_success = 'REGISTRATION';
    }
    const identityStrategy = ['customer_user_id', 'appsflyer_id', 'advertising_id'].filter((f) => Object.values(columnMapping).includes(f));
    const critical = this.criticalColumns(input.source, input.reportType, columnMapping);
    const confidence = Math.max(0.5, Math.min(0.95, Object.keys(columnMapping).length / Math.max(input.headers.length, 1) + 0.25));
    return {
      source: input.source,
      reportType: input.reportType,
      confidence,
      recommendedAction: critical.missing.length === 0 && critical.ambiguous.length === 0 ? 'mapping_confirmed' : 'mapping_review_required',
      columnMapping,
      eventMapping,
      identityStrategy,
      currencyCandidates: this.findCurrencyCandidates(input),
      timezoneCandidates: this.findTimezoneCandidates(input),
      sensitiveFields,
      criticalColumns: critical,
      dataQualityWarnings: critical.missing.map((c) => `Missing critical column: ${c}`),
      questionsForUser: critical.missing.map((c) => `Which CSV column should map to ${c}?`),
      sanitizedSampleRows,
    };
  }

  sanitizeSampleRows(headers: string[], sampleRows: Record<string, string>[]): Record<string, unknown>[] {
    return sampleRows.slice(0, 5).map((row) => Object.fromEntries(headers.map((header) => {
      const raw = row[header] ?? '';
      if (this.isSensitiveHeader(header) || this.looksSensitive(raw)) return [header, '[REDACTED]'];
      const value = String(raw).slice(0, 80);
      return [header, { empty: value.trim().length === 0, sample: value }];
    })));
  }

  private suggestColumnMapping(headers: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const header of headers) {
      const key = header.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
      if (CANONICAL_ALIASES[key]) result[header] = CANONICAL_ALIASES[key];
    }
    return result;
  }
  private isSensitiveHeader(header: string): boolean { return SENSITIVE_HEADER_PATTERNS.some((p) => p.test(header)); }
  private looksSensitive(value: string): boolean { return /\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(value) || /@/.test(value) || /bearer\s+/i.test(value); }
  private criticalColumns(source: string, reportType: string, mapping: Record<string, string>) {
    const present = Object.values(mapping); const missing: string[] = []; const ambiguous: string[] = [];
    const hasAny = (...fields: string[]) => fields.some((f) => present.includes(f));
    if (source === DataSource.APPSFLYER && reportType === ReportType.INSTALLS) { if (!hasAny('event_name','install_time')) missing.push('event_name_or_install_time'); if (!hasAny('appsflyer_id','advertising_id')) missing.push('appsflyer_id_or_advertising_id'); }
    if (source === DataSource.APPSFLYER && [ReportType.IN_APP_EVENTS, ReportType.NON_ORGANIC_IN_APP_EVENTS].includes(reportType as ReportType)) { for (const f of ['event_name','event_time']) if (!present.includes(f)) missing.push(f); if (!hasAny('appsflyer_id','customer_user_id','advertising_id')) missing.push('identity'); }
    return { present, missing, ambiguous };
  }
  private findCurrencyCandidates(input: SchemaAssistantRequest): string[] { const hay = `${input.fileName ?? ''} ${JSON.stringify(input.sampleRows.slice(0, 3))}`; return ['USD','CAD','EUR','GBP'].filter((c) => hay.includes(c)); }
  private findTimezoneCandidates(input: SchemaAssistantRequest): string[] { const hay = `${input.fileName ?? ''} ${JSON.stringify(input)}`; return /toronto|canada|cad/i.test(hay) ? ['America/Toronto'] : ['UTC']; }
}
