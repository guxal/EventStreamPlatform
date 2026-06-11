import { Module } from '@nestjs/common';
import { QueueModule } from '@metrics-platform/core-infrastructure';
import { MarketingInfrastructureModule } from '@metrics-platform/marketing-infrastructure';
import { AiExplainerService } from '../ai/ai-explainer.service';
import { AiContextBuilderService } from '../ai/context';
import { AiProviderFactory } from '../ai/providers';
import { RecommendationGeneratorService } from '../ai/recommendation-generator.service';
import { ReportGeneratorService } from '../ai/report-generator.service';
import { AiAnalysisRunnerService } from '../ai/analysis';
import { AiOutputOrchestratorService } from '../ai/orchestration/ai-output-orchestrator.service';
import { AiQuestionAnsweringService, AiQuestionDataService, AiQuestionIntentRouter } from '../ai/questions';
import { FileHubService } from '../file-hub/file-hub.service';
import { FileProfilerService } from '../file-hub/file-profiler.service';
import { ReportClassifierService } from '../file-hub/report-classifier.service';
import { AppsFlyerSemanticAdapter, ContextBuilderService, SemanticBuilderService } from '../semantic';

@Module({
  imports: [MarketingInfrastructureModule, QueueModule],
  providers: [
    AiExplainerService,
    AiContextBuilderService,
    AiProviderFactory,
    RecommendationGeneratorService,
    ReportGeneratorService,
    AiOutputOrchestratorService,
    AiAnalysisRunnerService,
    AiQuestionIntentRouter,
    AiQuestionDataService,
    AiQuestionAnsweringService,
    FileHubService,
    FileProfilerService,
    ReportClassifierService,
    AppsFlyerSemanticAdapter,
    SemanticBuilderService,
    ContextBuilderService,
  ],
  exports: [
    AiExplainerService,
    AiContextBuilderService,
    AiProviderFactory,
    RecommendationGeneratorService,
    ReportGeneratorService,
    AiOutputOrchestratorService,
    AiAnalysisRunnerService,
    AiQuestionIntentRouter,
    AiQuestionDataService,
    AiQuestionAnsweringService,
    FileHubService,
    FileProfilerService,
    ReportClassifierService,
    ContextBuilderService,
    SemanticBuilderService,
    AppsFlyerSemanticAdapter,
  ],
})
export class MarketingApplicationModule {}
