import { Injectable } from '@nestjs/common';
import { createInterface } from 'readline';
import type { Readable } from 'stream';
import { EntityType, FactType, Severity, type RawImportFileRecord, type ReportType } from '@metrics-platform/marketing-shared';
import type { AppsFlyerProcessingContext, AppsFlyerReportProfileResult } from './appsflyer.types';
import { AppsFlyerCsvStreamParserPlugin } from './appsflyer-csv-stream-parser.plugin';

const EXPORT_LIMITS = new Set([200000, 500000, 1000000]);

@Injectable()
export class AppsFlyerReportProfilerPlugin {
  constructor(private readonly csvParser: AppsFlyerCsvStreamParserPlugin) {}

  async profile(input: {
    context: AppsFlyerProcessingContext;
    stream?: Readable;
    existingProfile?: RawImportFileRecord | null;
  }): Promise<AppsFlyerReportProfileResult> {
    const existing = input.existingProfile;
    if (existing?.rowCount !== null && existing?.rowCount !== undefined && existing.headers.length > 0) {
      return this.toResult(input.context, input.context.reportType, existing.headers, existing.rowCount, existing.sampleRows, existing.classificationConfidence);
    }
    if (!input.stream) throw new Error('stream is required when no File Hub profile exists');

    const rl = createInterface({ input: input.stream, crlfDelay: Infinity });
    let headers: string[] = [];
    const sampleRows: Record<string, string>[] = [];
    let rowCount = 0;
    for await (const line of rl) {
      if (headers.length === 0) { headers = this.csvParser.parseCsvLine(line); continue; }
      if (line.trim() === '') continue;
      rowCount += 1;
      if (sampleRows.length < 5) {
        const values = this.csvParser.parseCsvLine(line);
        const sample: Record<string, string> = {};
        headers.forEach((header, index) => { sample[header] = values[index] ?? ''; });
        sampleRows.push(sample);
      }
    }
    return this.toResult(input.context, input.context.reportType, headers, rowCount, sampleRows, 1);
  }

  private toResult(
    context: AppsFlyerProcessingContext,
    reportType: ReportType,
    headers: string[],
    rowCount: number,
    sampleRows: Record<string, string>[],
    classificationConfidence: number,
  ): AppsFlyerReportProfileResult {
    const preparedFacts = [];
    const today = new Date().toISOString().slice(0, 10);
    if (rowCount === 0) {
      preparedFacts.push({
        entityId: context.projectId,
        entityType: EntityType.ACCOUNT,
        factType: FactType.EMPTY_REPORT,
        severity: Severity.INFO,
        confidence: 0.99,
        temporalContext: { lookbackDays: 0, startDate: today, endDate: today },
        metricsSummary: { source: context.source, reportType, rowCount },
        recommendationHint: 'The AppsFlyer report is empty. Confirm the selected report date range and filters before drawing conclusions.',
      });
    }
    if (EXPORT_LIMITS.has(rowCount)) {
      preparedFacts.push({
        entityId: context.projectId,
        entityType: EntityType.ACCOUNT,
        factType: FactType.DATA_EXPORT_LIMIT_REACHED,
        severity: Severity.WARNING,
        confidence: 0.95,
        temporalContext: { lookbackDays: 0, startDate: today, endDate: today },
        metricsSummary: { source: context.source, reportType, rowCount },
        recommendationHint: 'The row count matches a known AppsFlyer export limit. Split the export by date or dimensions to avoid truncated analysis.',
      });
    }
    return { reportType, headers, rowCount, sampleRows, isEmpty: rowCount === 0, exportLimitReached: EXPORT_LIMITS.has(rowCount), classificationConfidence, preparedFacts };
  }
}
