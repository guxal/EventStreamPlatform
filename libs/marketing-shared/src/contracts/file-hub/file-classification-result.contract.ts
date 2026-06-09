import { DataSource } from '../../enums/data-source.enum';
import { ReportType } from '../../enums/report-type.enum';

export interface FileClassificationResult {
  source: DataSource;
  reportType: ReportType;
  confidence: number;
  reasons: string[];
}
