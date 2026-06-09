import { DataSource, ReportType, type FileProfile } from '@metrics-platform/marketing-shared';
import { ReportClassifierService } from './report-classifier.service';

const profile = (headers: string[]): FileProfile => ({
  headers,
  rowCount: 2,
  sampleRows: [],
  sizeBytes: 100,
  checksum: 'checksum',
  isEmpty: false,
  warnings: [],
});

describe('ReportClassifierService', () => {
  const service = new ReportClassifierService();

  it('classifies AppsFlyer installs from filename and headers with high confidence', () => {
    const result = service.classify({
      fileName: 'appsflyer_installs_report.csv',
      profile: profile(['AppsFlyer ID', 'Install Time', 'Media Source', 'Campaign']),
    });

    expect(result.source).toBe(DataSource.APPSFLYER);
    expect(result.reportType).toBe(ReportType.INSTALLS);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies AppsFlyer in-app events', () => {
    const result = service.classify({
      fileName: 'in-app-events.csv',
      profile: profile(['AppsFlyer ID', 'Event Name', 'Event Time', 'Event Value', 'Event Revenue']),
    });

    expect(result.source).toBe(DataSource.APPSFLYER);
    expect(result.reportType).toBe(ReportType.IN_APP_EVENTS);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies AppsFlyer blocked installs', () => {
    const result = service.classify({
      fileName: 'blocked-installs.csv',
      profile: profile(['AppsFlyer ID', 'Install Time', 'Media Source', 'Blocked Reason', 'Rejected Reason']),
    });

    expect(result.source).toBe(DataSource.APPSFLYER);
    expect(result.reportType).toBe(ReportType.BLOCKED_INSTALLS);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies Google Ads campaigns', () => {
    const result = service.classify({
      fileName: 'google_ads_campaigns.csv',
      profile: profile(['Campaign', 'Campaign ID', 'Impressions', 'Clicks', 'Cost', 'Conversions', 'CTR', 'Avg. CPC']),
    });

    expect(result.source).toBe(DataSource.GOOGLE_ADS);
    expect(result.reportType).toBe(ReportType.CAMPAIGNS);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies Google Ads keywords', () => {
    const result = service.classify({
      fileName: 'keywords.csv',
      profile: profile(['Campaign', 'Keyword', 'Match type', 'Impressions', 'Clicks', 'Cost', 'Conversions']),
    });

    expect(result.source).toBe(DataSource.GOOGLE_ADS);
    expect(result.reportType).toBe(ReportType.KEYWORDS);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('marks unknown CSVs as low confidence', () => {
    const result = service.classify({
      fileName: 'random_export.csv',
      profile: profile(['Name', 'Email', 'Created At']),
    });

    expect(result.source).toBe(DataSource.UNKNOWN);
    expect(result.reportType).toBe(ReportType.UNKNOWN);
    expect(result.confidence).toBeLessThan(0.5);
  });
});
