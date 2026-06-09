import { Module } from '@nestjs/common';
import { AnalysisEngineService } from '../analysis-engine/analysis-engine.service';
import {
  AppsFlyerColumnMapper,
  AppsFlyerCsvStreamParserPlugin,
  AppsFlyerEventDictionaryPlugin,
  AppsFlyerEventValueParserPlugin,
  AppsFlyerFactsPlugin,
  AppsFlyerKpiCalculatorPlugin,
  AppsFlyerNormalizerPlugin,
  AppsFlyerProcessingPipelineService,
  AppsFlyerReportProfilerPlugin,
} from '../appsflyer';

const appsFlyerProviders = [
  AppsFlyerColumnMapper,
  AppsFlyerCsvStreamParserPlugin,
  AppsFlyerEventDictionaryPlugin,
  AppsFlyerEventValueParserPlugin,
  AppsFlyerFactsPlugin,
  AppsFlyerKpiCalculatorPlugin,
  AppsFlyerNormalizerPlugin,
  AppsFlyerProcessingPipelineService,
  AppsFlyerReportProfilerPlugin,
];

@Module({
  providers: [AnalysisEngineService, ...appsFlyerProviders],
  exports: [AnalysisEngineService, ...appsFlyerProviders],
})
export class MarketingPluginsModule {}
