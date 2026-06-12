import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { DetectedFact } from '@metrics-platform/marketing-shared';
import { AiReportRepository, RecommendationRepository } from '@metrics-platform/marketing-infrastructure';
import { AiContextBuilderService } from '../context';
import { RecommendationGeneratorService } from '../recommendation-generator.service';
import { ReportGeneratorService } from '../report-generator.service';
import { AiProviderError, AiProviderFactory, AiProviderName } from '../providers';
import type { AiReportRecord, RecommendationRecord } from './ai-output.types';

export type AiOutputContextExtras = {
  kpis?: Record<string, unknown>;
  unavailableMetrics?: Array<{ metric: string; reason: string }>;
  warnings?: string[];
  dataQualityNotes?: string[];
  semanticEntities?: unknown[];
  semanticRelationships?: unknown[];
  contextObjects?: unknown[];
};

@Injectable()
export class AiOutputOrchestratorService {
  private readonly logger = new Logger(AiOutputOrchestratorService.name);

  constructor(
    private readonly recommendationGenerator: RecommendationGeneratorService,
    private readonly reportGenerator: ReportGeneratorService,
    private readonly recommendationRepository: RecommendationRepository,
    private readonly aiReportRepository: AiReportRepository,
    private readonly contextBuilder: AiContextBuilderService,
    private readonly providerFactory: AiProviderFactory,
  ) {}

  async generateAndStoreRecommendations(projectId: string, facts: DetectedFact[], extras: AiOutputContextExtras = {}): Promise<RecommendationRecord[]> {
    try {
      if (facts.length === 0) {
        this.logger.log({ projectId, generationStatus: 'SKIPPED', reason: 'NO_FACTS', outputType: 'recommendations' });
        return [];
      }
      const provider = this.providerFactory.getProvider();
      const context = this.contextBuilder.buildContext({ projectId, facts, ...extras });
      this.logger.log({ projectId, outputType: 'recommendations', provider: this.providerName(provider.name), factsCount: context.facts.length, kpiKeys: Object.keys(context.kpis).length, unavailableMetrics: context.unavailableMetrics.length });
      const generated = await this.recommendationGenerator.generateFromContext(context, provider);
      const toPersist: RecommendationRecord[] = generated.map((item, index) => {
        const sourceFact = facts[index] ?? facts.find((fact) => fact.factType === item.factType);
        return {
          id: randomUUID(),
          projectId,
          factType: item.factType,
          title: item.title,
          body: item.body,
          priority: item.priority,
          modelName: this.providerName(provider.name),
          modelVersion: this.modelName(provider.name),
          createdAt: new Date().toISOString(),
          metadata: {
            ...this.metadataFromFact(sourceFact),
            provider: this.providerName(provider.name),
            model: this.modelName(provider.name),
            generationStatus: this.generationStatus(provider.name),
            summary: item.summary ?? item.body,
            recommendedActions: item.recommendedActions ?? [],
            limitations: item.limitations ?? [],
            confidence: item.confidence ?? sourceFact?.confidence ?? 0,
            relatedFactIds: item.relatedFactIds ?? [String(sourceFact?.factType ?? item.factType)],
            relatedEntityIds: item.relatedEntityIds ?? (sourceFact?.entityId ? [sourceFact.entityId] : []),
            rawAiOutput: item.rawAiOutput,
          },
        };
      });
      await this.replaceRecommendationsByScope(projectId, facts);
      const saved = await this.recommendationRepository.saveMany(toPersist);
      this.logger.log({ projectId, outputType: 'recommendations', generationStatus: this.generationStatus(provider.name), saved: saved.length });
      return saved;
    } catch (error) {
      this.logger.warn({ projectId, outputType: 'recommendations', generationStatus: 'SKIPPED', error: this.errorMessage(error) });
      if (process.env.AI_REQUIRED === 'true') throw error;
      return this.persistAiSkippedRecommendation(projectId, facts, error);
    }
  }

  async generateAndStoreReport(projectId: string, facts: DetectedFact[], extras: AiOutputContextExtras = {}): Promise<AiReportRecord> {
    try {
      const provider = this.providerFactory.getProvider();
      const context = this.contextBuilder.buildContext({ projectId, facts, ...extras });
      this.logger.log({ projectId, outputType: 'report', provider: this.providerName(provider.name), factsCount: context.facts.length, kpiKeys: Object.keys(context.kpis).length, unavailableMetrics: context.unavailableMetrics.length });
      const generated = await this.reportGenerator.generateMarkdownReportFromContext(context, provider);
      const report: AiReportRecord = {
        id: randomUUID(),
        projectId,
        reportType: 'WEEKLY',
        title: 'AI Marketing Performance Report',
        contentMarkdown: generated.content,
        modelName: this.providerName(provider.name),
        modelVersion: this.modelName(provider.name),
        createdAt: new Date().toISOString(),
        metadata: {
          ...this.metadataFromFacts(facts),
          provider: this.providerName(provider.name),
          model: this.modelName(provider.name),
          generationStatus: this.generationStatus(provider.name),
          content: generated.content,
          rawAiOutput: generated.rawAiOutput,
        },
      };
      await this.replaceReportsByScope(projectId, facts);
      const saved = await this.aiReportRepository.save(report);
      this.logger.log({ projectId, outputType: 'report', generationStatus: this.generationStatus(provider.name), reportId: saved.id });
      return saved;
    } catch (error) {
      this.logger.warn({ projectId, outputType: 'report', generationStatus: 'SKIPPED', error: this.errorMessage(error) });
      if (process.env.AI_REQUIRED === 'true') throw error;
      return this.persistAiSkippedReport(projectId, facts, error);
    }
  }

  private async replaceRecommendationsByScope(projectId: string, facts: DetectedFact[]): Promise<void> {
    const scope = this.scopeFromFacts(facts);
    if (!scope.importId && !scope.source && !scope.reportType) return;
    await this.recommendationRepository.deleteByScope(projectId, scope);
  }

  private async replaceReportsByScope(projectId: string, facts: DetectedFact[]): Promise<void> {
    const scope = this.scopeFromFacts(facts);
    if (!scope.importId && !scope.source && !scope.reportType) return;
    await this.aiReportRepository.deleteByScope(projectId, scope);
  }

  private scopeFromFacts(facts: DetectedFact[]): { source?: string; reportType?: string; importId?: string } {
    return {
      source: String(facts[0]?.metricsSummary?.source ?? '').toLowerCase() || undefined,
      reportType: String(facts[0]?.metricsSummary?.reportType ?? '') || undefined,
      importId: String(facts[0]?.metricsSummary?.dataImportId ?? facts[0]?.metricsSummary?.importId ?? '') || undefined,
    };
  }

  private async persistAiSkippedRecommendation(projectId: string, facts: DetectedFact[], error: unknown): Promise<RecommendationRecord[]> {
    if (facts.length === 0) return [];
    const fact = facts[0];
    const item: RecommendationRecord = {
      id: randomUUID(),
      projectId,
      factType: fact.factType,
      title: 'AI recommendation generation skipped',
      body: 'AI provider was not configured or failed. Import processing completed without AI recommendations.',
      priority: 'LOW',
      modelName: 'NONE',
      modelVersion: 'none',
      createdAt: new Date().toISOString(),
      metadata: {
        ...this.metadataFromFact(fact),
        generationStatus: 'SKIPPED',
        errorMessage: this.errorMessage(error),
        provider: 'NONE',
        model: 'none',
        limitations: ['AI output was skipped; detected facts remain available.'],
        recommendedActions: [],
        confidence: 0,
      },
    };
    await this.replaceRecommendationsByScope(projectId, facts);
    return this.recommendationRepository.saveMany([item]);
  }

  private async persistAiSkippedReport(projectId: string, facts: DetectedFact[], error: unknown): Promise<AiReportRecord> {
    const content = this.reportGenerator.generateMarkdownReport(projectId, facts);
    const report: AiReportRecord = {
      id: randomUUID(),
      projectId,
      reportType: 'WEEKLY',
      title: 'AI Marketing Performance Report (AI skipped)',
      contentMarkdown: content,
      modelName: 'NONE',
      modelVersion: 'none',
      createdAt: new Date().toISOString(),
      metadata: {
        ...this.metadataFromFacts(facts),
        generationStatus: 'SKIPPED',
        errorMessage: this.errorMessage(error),
        provider: 'NONE',
        model: 'none',
        content,
      },
    };
    await this.replaceReportsByScope(projectId, facts);
    return this.aiReportRepository.save(report);
  }

  private providerName(name: AiProviderName): string {
    return name === AiProviderName.MOCK ? 'mock' : name.toLowerCase();
  }

  private modelName(name: AiProviderName): string {
    return name === AiProviderName.MOCK ? 'mock-local' : process.env.AI_MODEL || name.toLowerCase();
  }

  private generationStatus(name: AiProviderName): 'MOCKED' | 'COMPLETED' {
    return name === AiProviderName.MOCK ? 'MOCKED' : 'COMPLETED';
  }

  private metadataFromFact(fact: DetectedFact | undefined): Record<string, unknown> {
    return {
      source: fact?.metricsSummary?.source,
      reportType: fact?.metricsSummary?.reportType,
      dataImportId: fact?.metricsSummary?.dataImportId,
      importId: fact?.metricsSummary?.dataImportId,
      rawFileId: fact?.metricsSummary?.rawFileId,
      factType: fact?.factType,
      entityType: fact?.entityType,
      entityId: fact?.entityId,
    };
  }

  private metadataFromFacts(facts: DetectedFact[]): Record<string, unknown> {
    const dataImportIds = Array.from(new Set(facts.map((fact) => fact.metricsSummary?.dataImportId).filter(Boolean)));
    return {
      source: facts[0]?.metricsSummary?.source,
      reportType: facts[0]?.metricsSummary?.reportType,
      dataImportIds,
      importId: dataImportIds[0],
      rawFileId: facts[0]?.metricsSummary?.rawFileId,
      relatedFactIds: facts.map((fact) => String(fact.id ?? fact.factType)),
      relatedEntityIds: Array.from(new Set(facts.map((fact) => fact.entityId).filter(Boolean))),
      factTypes: facts.map((fact) => fact.factType),
    };
  }

  private errorMessage(error: unknown): string {
    if (error instanceof AiProviderError) return `${error.code}: ${error.message}`;
    return error instanceof Error ? error.message : String(error);
  }
}
