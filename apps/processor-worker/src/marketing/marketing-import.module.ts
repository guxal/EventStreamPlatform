import { Module } from '@nestjs/common';
import { QueueModule } from '@metrics-platform/core-infrastructure';
import { MarketingApplicationModule } from '@metrics-platform/marketing-application';
import { MarketingInfrastructureModule } from '@metrics-platform/marketing-infrastructure';
import { MarketingPluginsModule } from '@metrics-platform/marketing-plugins';
import { AiAnalysisProcessor } from './ai-analysis.processor';
import { ProjectGoldProcessor } from './project-gold.processor';
import { AppsFlyerImportProcessor } from './appsflyer-import.processor';

@Module({
  imports: [MarketingInfrastructureModule, MarketingApplicationModule, MarketingPluginsModule, QueueModule],
  providers: [AppsFlyerImportProcessor, AiAnalysisProcessor, ProjectGoldProcessor],
})
export class MarketingImportModule {}
