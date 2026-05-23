import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { DetectedFact } from '@metrics-platform/marketing-shared';
import { RecommendationRepository, AiReportRepository } from '@metrics-platform/marketing-infrastructure';
import { RecommendationGeneratorService } from '../recommendation-generator.service';
import { ReportGeneratorService } from '../report-generator.service';
import type { AiReportRecord, RecommendationRecord } from './ai-output.types';

@Injectable()
export class AiOutputOrchestratorService {
  constructor(
    private readonly recommendationGenerator: RecommendationGeneratorService,
    private readonly reportGenerator: ReportGeneratorService,
    private readonly recommendationRepository: RecommendationRepository,
    private readonly aiReportRepository: AiReportRepository,
  ) {}

  generateAndStoreRecommendations(projectId: string, facts: DetectedFact[]): RecommendationRecord[] {
    const generated = this.recommendationGenerator.generateFromFacts(facts);
    const modelName = process.env.AI_MODEL_NAME || 'gpt-5.3-codex';
    const modelVersion = process.env.AI_MODEL_VERSION || 'v1';

    const toPersist: RecommendationRecord[] = generated.map((item) => ({
      id: randomUUID(),
      projectId,
      factType: item.factType,
      title: item.title,
      body: item.body,
      priority: item.priority,
      modelName,
      modelVersion,
      createdAt: new Date().toISOString(),
    }));

    return this.recommendationRepository.saveMany(toPersist);
  }

  generateAndStoreReport(projectId: string, facts: DetectedFact[]): AiReportRecord {
    const contentMarkdown = this.reportGenerator.generateMarkdownReport(projectId, facts);
    const modelName = process.env.AI_MODEL_NAME || 'gpt-5.3-codex';
    const modelVersion = process.env.AI_MODEL_VERSION || 'v1';

    const report: AiReportRecord = {
      id: randomUUID(),
      projectId,
      reportType: 'WEEKLY',
      title: 'AI Marketing Performance Report',
      contentMarkdown,
      modelName,
      modelVersion,
      createdAt: new Date().toISOString(),
    };

    return this.aiReportRepository.save(report);
  }
}
