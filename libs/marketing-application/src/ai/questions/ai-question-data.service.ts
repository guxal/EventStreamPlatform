import { Injectable } from '@nestjs/common';
import { AiReportRepository, AppsFlyerEventsRepository, ContextObjectRepository, DataImportsReaderRepository, DetectedFactRepository, RecommendationRepository, SemanticEntityRepository, SemanticRelationshipRepository } from '@metrics-platform/marketing-infrastructure';

export type AiQuestionDataInput = { projectId: string; source?: string; reportType?: string; importId?: string; dateRange?: { from?: string; to?: string }; limit?: number };

@Injectable()
export class AiQuestionDataService {
  constructor(
    private readonly detectedFactRepository: DetectedFactRepository,
    private readonly recommendationRepository: RecommendationRepository,
    private readonly aiReportRepository: AiReportRepository,
    private readonly appsFlyerEventsRepository: AppsFlyerEventsRepository,
    private readonly dataImportsReaderRepository: DataImportsReaderRepository,
    private readonly semanticEntityRepository: SemanticEntityRepository,
    private readonly semanticRelationshipRepository: SemanticRelationshipRepository,
    private readonly contextObjectRepository: ContextObjectRepository,
  ) {}

  async getProjectOverview(input: AiQuestionDataInput) { return this.sourceIsAppsFlyer(input) ? this.appsFlyerEventsRepository.getOverview(input.projectId) : { projectId: input.projectId, source: input.source, warnings: ['No adapter for this source yet.'] }; }
  async getImportSummary(input: AiQuestionDataInput) { return input.importId ? this.dataImportsReaderRepository.getAppsFlyerImportSummary(input.projectId, input.importId) : null; }
  async getTopFacts(input: AiQuestionDataInput) { return (await this.detectedFactRepository.listByProject(input.projectId, { source: input.source, reportType: input.reportType, importId: input.importId })).slice(0, input.limit ?? 20); }
  async getRecommendations(input: AiQuestionDataInput) { return (await this.recommendationRepository.listByProject(input.projectId, { source: input.source, reportType: input.reportType, importId: input.importId })).slice(0, input.limit ?? 10); }
  async getLatestReports(input: AiQuestionDataInput) { return (await this.aiReportRepository.listByProject(input.projectId, { source: input.source, reportType: input.reportType, importId: input.importId })).slice(0, input.limit ?? 3); }
  async getEventsByName(input: AiQuestionDataInput) { return this.sourceIsAppsFlyer(input) ? this.appsFlyerEventsRepository.getEventsByName(input.projectId, { importId: input.importId, reportType: input.reportType, from: input.dateRange?.from, to: input.dateRange?.to }) : []; }
  async getEntityPerformance(input: AiQuestionDataInput) { return this.sourceIsAppsFlyer(input) ? this.appsFlyerEventsRepository.getMediaSources(input.projectId) : []; }
  async getCampaignPerformance(input: AiQuestionDataInput) { return this.sourceIsAppsFlyer(input) ? this.appsFlyerEventsRepository.getCampaigns(input.projectId) : []; }
  async getBlockedTraffic(input: AiQuestionDataInput) { return this.sourceIsAppsFlyer(input) ? this.appsFlyerEventsRepository.getBlockedTraffic(input.projectId) : {}; }
  async getSemanticEntities(input: AiQuestionDataInput) { return (await this.semanticEntityRepository.searchEntities(input.projectId, { source: input.source, importId: input.importId, reportType: input.reportType })).slice(0, input.limit ?? 50); }
  async getSemanticRelationships(input: AiQuestionDataInput) { return (await this.semanticRelationshipRepository.searchRelationships(input.projectId, { source: input.source, importId: input.importId, reportType: input.reportType })).slice(0, input.limit ?? 100); }
  async getContextObjects(input: AiQuestionDataInput) { return (await this.contextObjectRepository.searchContextObjects(input.projectId, { source: input.source, reportType: input.reportType })).slice(0, input.limit ?? 30); }
  async getUnavailableMetrics(input: AiQuestionDataInput) { const overview = await this.getProjectOverview(input); return (overview as any).unavailableMetrics ?? [{ metric: 'roas', reason: 'No reliable cost source is available in the bounded processed data.' }, { metric: 'cpa', reason: 'No reliable cost source is available in the bounded processed data.' }, { metric: 'cac', reason: 'No reliable cost source is available in the bounded processed data.' }]; }
  private sourceIsAppsFlyer(input: AiQuestionDataInput): boolean { return !input.source || input.source.toLowerCase() === 'appsflyer'; }
}
