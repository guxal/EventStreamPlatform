import { Module } from '@nestjs/common';
import { MarketingInfrastructureModule } from '@metrics-platform/marketing-infrastructure';
import { AiExplainerService } from '../ai/ai-explainer.service';
import { RecommendationGeneratorService } from '../ai/recommendation-generator.service';
import { ReportGeneratorService } from '../ai/report-generator.service';
import { AiOutputOrchestratorService } from '../ai/orchestration/ai-output-orchestrator.service';

@Module({
  imports: [MarketingInfrastructureModule],
  providers: [
    AiExplainerService,
    RecommendationGeneratorService,
    ReportGeneratorService,
    AiOutputOrchestratorService,
  ],
  exports: [
    AiExplainerService,
    RecommendationGeneratorService,
    ReportGeneratorService,
    AiOutputOrchestratorService,
  ],
})
export class MarketingApplicationModule {}
