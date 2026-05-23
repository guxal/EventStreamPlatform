import { Module } from '@nestjs/common';
import { AnalysisEngineService } from '../analysis-engine/analysis-engine.service';

@Module({
  providers: [AnalysisEngineService],
  exports: [AnalysisEngineService],
})
export class MarketingPluginsModule {}
