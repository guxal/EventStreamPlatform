import { Module } from '@nestjs/common';
import { MarketingApplicationModule } from '@metrics-platform/marketing-application';
import { MarketingInfrastructureModule } from '@metrics-platform/marketing-infrastructure';
import { MarketingPluginsModule } from '@metrics-platform/marketing-plugins';
import { AiAnalysisProcessor } from './ai-analysis.processor';
import { AppsFlyerImportProcessor } from './appsflyer-import.processor';

@Module({
  imports: [MarketingInfrastructureModule, MarketingApplicationModule, MarketingPluginsModule],
  providers: [AppsFlyerImportProcessor, AiAnalysisProcessor],
})
export class MarketingImportModule {}
