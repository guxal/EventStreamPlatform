import { Module } from '@nestjs/common';
import { QueueModule } from '@metrics-platform/core-infrastructure';
import { MarketingInfrastructureModule } from '@metrics-platform/marketing-infrastructure';
import { AiExplainerService } from '../ai/ai-explainer.service';
import { RecommendationGeneratorService } from '../ai/recommendation-generator.service';
import { ReportGeneratorService } from '../ai/report-generator.service';
import { AiOutputOrchestratorService } from '../ai/orchestration/ai-output-orchestrator.service';
import { FileHubService } from '../file-hub/file-hub.service';
import { FileProfilerService } from '../file-hub/file-profiler.service';
import { ReportClassifierService } from '../file-hub/report-classifier.service';

@Module({
  imports: [MarketingInfrastructureModule, QueueModule],
  providers: [
    AiExplainerService,
    RecommendationGeneratorService,
    ReportGeneratorService,
    AiOutputOrchestratorService,
    FileHubService,
    FileProfilerService,
    ReportClassifierService,
  ],
  exports: [
    AiExplainerService,
    RecommendationGeneratorService,
    ReportGeneratorService,
    AiOutputOrchestratorService,
    FileHubService,
    FileProfilerService,
    ReportClassifierService,
  ],
})
export class MarketingApplicationModule {}
