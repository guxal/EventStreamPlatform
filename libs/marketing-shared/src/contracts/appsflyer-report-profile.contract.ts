import { AppsFlyerReportType } from '../enums/appsflyer-report-type.enum';

export type AppsFlyerReportProfile = {
  reportType: AppsFlyerReportType;
  detectedBy: 'filename' | 'headers';
  rowCount: number;
  isEmpty: boolean;
  exportLimitReached: boolean;
  exportLimitThreshold?: 200000 | 500000 | 1000000;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  stageDurationsMs?: {
    bronze?: number;
    silver?: number;
    gold?: number;
  };
  stageErrors?: Array<{
    layer: 'BRONZE' | 'SILVER' | 'GOLD';
    message: string;
    isPartial: boolean;
  }>;
};
