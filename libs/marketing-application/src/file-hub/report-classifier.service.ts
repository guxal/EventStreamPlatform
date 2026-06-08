import { Injectable } from '@nestjs/common';
import { DataSource, ReportType, type FileClassificationResult, type FileProfile } from '@metrics-platform/marketing-shared';

type RuleMatch = {
  source: DataSource;
  reportType: ReportType;
  filenameScore: number;
  headerScore: number;
  reasons: string[];
};

const APPSFLYER_HEADER_HINTS = [
  'appsflyer id',
  'event name',
  'event time',
  'install time',
  'media source',
  'campaign',
  'event value',
  'event revenue',
  'blocked reason',
  'rejected reason',
];

const GOOGLE_ADS_HEADER_HINTS = [
  'campaign',
  'campaign id',
  'keyword',
  'search term',
  'match type',
  'impressions',
  'clicks',
  'cost',
  'conversions',
  'conversion value',
  'ctr',
  'avg. cpc',
];

const APPSFLYER_FILENAME_REPORTS: Array<[RegExp, ReportType, string]> = [
  [/non[-_\s]?organic[-_\s]?in[-_\s]?app[-_\s]?events/i, ReportType.NON_ORGANIC_IN_APP_EVENTS, 'filename:non-organic-in-app-events'],
  [/in[-_\s]?app[-_\s]?events[-_\s]?postbacks|postbacks/i, ReportType.IN_APP_EVENTS_POSTBACKS, 'filename:postbacks'],
  [/blocked[-_\s]?in[-_\s]?app[-_\s]?events/i, ReportType.BLOCKED_IN_APP_EVENTS, 'filename:blocked-in-app-events'],
  [/blocked[-_\s]?installs/i, ReportType.BLOCKED_INSTALLS, 'filename:blocked-installs'],
  [/blocked[-_\s]?clicks/i, ReportType.BLOCKED_CLICKS, 'filename:blocked-clicks'],
  [/in[-_\s]?app[-_\s]?events/i, ReportType.IN_APP_EVENTS, 'filename:in-app-events'],
  [/ad[-_\s]?revenue/i, ReportType.AD_REVENUE, 'filename:ad-revenue'],
  [/uninstall/i, ReportType.UNINSTALLS, 'filename:uninstall'],
  [/conversions?/i, ReportType.CONVERSIONS, 'filename:conversions'],
  [/installs?/i, ReportType.INSTALLS, 'filename:installs'],
];

const GOOGLE_ADS_FILENAME_REPORTS: Array<[RegExp, ReportType, string]> = [
  [/search[-_\s]?terms?/i, ReportType.SEARCH_TERMS, 'filename:search-terms'],
  [/campaigns?/i, ReportType.CAMPAIGNS, 'filename:campaigns'],
  [/keywords?/i, ReportType.KEYWORDS, 'filename:keywords'],
  [/\bads?\b/i, ReportType.ADS, 'filename:ads'],
  [/\bgeo\b/i, ReportType.GEO, 'filename:geo'],
  [/devices?/i, ReportType.DEVICES, 'filename:devices'],
];

@Injectable()
export class ReportClassifierService {
  classify(input: { fileName: string; profile: FileProfile }): FileClassificationResult {
    const normalizedHeaders = input.profile.headers.map((header) => header.trim().toLowerCase());
    const matches = [
      this.matchSource(input.fileName, normalizedHeaders, DataSource.APPSFLYER, APPSFLYER_FILENAME_REPORTS, APPSFLYER_HEADER_HINTS),
      this.matchSource(input.fileName, normalizedHeaders, DataSource.GOOGLE_ADS, GOOGLE_ADS_FILENAME_REPORTS, GOOGLE_ADS_HEADER_HINTS),
    ].sort((a, b) => this.totalScore(b) - this.totalScore(a));

    const best = matches[0];
    const runnerUp = matches[1];

    if (!best || this.totalScore(best) === 0 || (runnerUp && this.totalScore(best) - this.totalScore(runnerUp) < 0.2)) {
      return {
        source: DataSource.UNKNOWN,
        reportType: ReportType.UNKNOWN,
        confidence: 0.25,
        reasons: ['classification:unknown-or-mixed-signals'],
      };
    }

    const confidence = this.calculateConfidence(best);
    if (confidence < 0.5) {
      return {
        source: DataSource.UNKNOWN,
        reportType: ReportType.UNKNOWN,
        confidence,
        reasons: [...best.reasons, 'classification:below-confidence-threshold'],
      };
    }

    return {
      source: best.source,
      reportType: best.reportType,
      confidence,
      reasons: best.reasons,
    };
  }

  private matchSource(
    fileName: string,
    normalizedHeaders: string[],
    source: DataSource,
    filenameRules: Array<[RegExp, ReportType, string]>,
    headerHints: string[],
  ): RuleMatch {
    const reasons: string[] = [];
    let filenameScore = 0;
    let reportType = ReportType.UNKNOWN;

    for (const [pattern, candidateReportType, reason] of filenameRules) {
      if (pattern.test(fileName)) {
        filenameScore = 0.35;
        reportType = candidateReportType;
        reasons.push(reason);
        break;
      }
    }

    const matchedHeaderHints = headerHints.filter((hint) => normalizedHeaders.includes(hint));
    const headerScore = Math.min(0.55, matchedHeaderHints.length * 0.08);
    if (matchedHeaderHints.length > 0) {
      reasons.push(`headers:${matchedHeaderHints.join('|')}`);
    }

    if (reportType === ReportType.UNKNOWN) {
      reportType = this.inferReportTypeFromHeaders(source, normalizedHeaders);
      if (reportType !== ReportType.UNKNOWN) {
        reasons.push(`headers-report-type:${reportType}`);
      }
    }

    return { source, reportType, filenameScore, headerScore, reasons };
  }

  private inferReportTypeFromHeaders(source: DataSource, headers: string[]): ReportType {
    if (source === DataSource.APPSFLYER) {
      if (headers.includes('blocked reason') || headers.includes('rejected reason')) return ReportType.BLOCKED_INSTALLS;
      if (headers.includes('event name') || headers.includes('event value')) return ReportType.IN_APP_EVENTS;
      if (headers.includes('install time') || headers.includes('appsflyer id')) return ReportType.INSTALLS;
    }

    if (source === DataSource.GOOGLE_ADS) {
      if (headers.includes('search term')) return ReportType.SEARCH_TERMS;
      if (headers.includes('keyword')) return ReportType.KEYWORDS;
      if (headers.includes('campaign') || headers.includes('campaign id')) return ReportType.CAMPAIGNS;
    }

    return ReportType.UNKNOWN;
  }

  private calculateConfidence(match: RuleMatch): number {
    if (match.filenameScore > 0 && match.headerScore >= 0.32) return 0.92;
    if (match.headerScore >= 0.4) return 0.85;
    if (match.headerScore >= 0.24) return 0.78;
    if (match.filenameScore > 0) return 0.62;
    return Math.min(0.49, this.totalScore(match));
  }

  private totalScore(match: RuleMatch): number {
    return match.filenameScore + match.headerScore;
  }
}
