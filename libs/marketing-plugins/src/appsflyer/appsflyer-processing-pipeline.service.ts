import { Injectable } from '@nestjs/common';
import { PassThrough, Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { DataSource, ReportType } from '@metrics-platform/marketing-shared';
import { AppsFlyerColumnMapper } from './appsflyer-column-mapper';
import { AppsFlyerCsvStreamParserPlugin } from './appsflyer-csv-stream-parser.plugin';
import { AppsFlyerEventValueParserPlugin } from './appsflyer-event-value-parser.plugin';
import { AppsFlyerFactsPlugin } from './appsflyer-facts.plugin';
import { AppsFlyerKpiCalculatorPlugin } from './appsflyer-kpi-calculator.plugin';
import { AppsFlyerNormalizerPlugin } from './appsflyer-normalizer.plugin';
import { AppsFlyerReportProfilerPlugin } from './appsflyer-report-profiler.plugin';
import type { AppsFlyerPipelineInput, AppsFlyerPipelineResult } from './appsflyer.types';

export const SUPPORTED_APPSFLYER_REPORT_TYPES = new Set<ReportType>([
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

@Injectable()
export class AppsFlyerProcessingPipelineService {
  constructor(
    private readonly profiler = new AppsFlyerReportProfilerPlugin(),
    private readonly parser = new AppsFlyerCsvStreamParserPlugin(),
    private readonly mapper = new AppsFlyerColumnMapper(),
    private readonly eventValueParser = new AppsFlyerEventValueParserPlugin(),
    private readonly normalizer = new AppsFlyerNormalizerPlugin(),
    private readonly kpiCalculator = new AppsFlyerKpiCalculatorPlugin(),
    private readonly factsPlugin = new AppsFlyerFactsPlugin(),
  ) {}

  async execute(input: AppsFlyerPipelineInput): Promise<AppsFlyerPipelineResult> {
    if (input.context.source !== DataSource.APPSFLYER) throw new Error(`Unsupported source ${input.context.source}`);
    if (!SUPPORTED_APPSFLYER_REPORT_TYPES.has(input.context.reportType)) throw new Error(`Unsupported AppsFlyer report type ${input.context.reportType}`);

    const [profileStream, parseStream] = input.existingProfile
      ? [undefined, input.stream] as const
      : this.tee(input.stream);
    const profile = await this.profiler.profile({ context: input.context, stream: profileStream, existingProfile: input.existingProfile });
    const events = [];
    const warnings: string[] = [];
    for await (const row of this.parser.parse(parseStream)) {
      if (Object.keys(row.raw).length === 0) { warnings.push(...row.warnings); continue; }
      const mapped = this.mapper.map(row);
      const parsed = this.eventValueParser.parse(mapped);
      warnings.push(...parsed.warnings.map((warning) => `row_${parsed.rowNumber}:${warning}`));
      events.push(this.normalizer.normalize(input.context, parsed));
    }
    const kpis = this.kpiCalculator.calculate(events, profile.rowCount);
    const facts = this.factsPlugin.generate(input.context, profile, kpis);
    return { profile, events, kpis, facts, warnings };
  }

  private tee(stream: Readable): [PassThrough, PassThrough] {
    const a = new PassThrough();
    const b = new PassThrough();
    void pipeline(stream, async function* (source: AsyncIterable<unknown>) {
      for await (const chunk of source) { a.write(chunk); b.write(chunk); yield chunk; }
      a.end(); b.end();
    }).catch((error: unknown) => { a.destroy(error); b.destroy(error); });
    return [a, b];
  }
}
