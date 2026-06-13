import { Injectable } from '@nestjs/common';
import { AiReportRepository, AppsFlyerEventsRepository, ContextObjectRepository, DataImportsReaderRepository, DetectedFactRepository, RecommendationRepository, ProjectAnalysisRunRepository, SemanticEntityRepository, SemanticRelationshipRepository } from '@metrics-platform/marketing-infrastructure';

export type AiQuestionDataInput = { projectId: string; source?: string; reportType?: string; importId?: string; dateRange?: { from?: string; to?: string }; limit?: number };

@Injectable()
export class AiQuestionDataService {
  constructor(
    private readonly detectedFactRepository: DetectedFactRepository,
    private readonly recommendationRepository: RecommendationRepository,
    private readonly aiReportRepository: AiReportRepository,
    private readonly appsFlyerEventsRepository: AppsFlyerEventsRepository,
    private readonly dataImportsReaderRepository: DataImportsReaderRepository,
    private readonly projectAnalysisRunRepository: ProjectAnalysisRunRepository,
    private readonly semanticEntityRepository: SemanticEntityRepository,
    private readonly semanticRelationshipRepository: SemanticRelationshipRepository,
    private readonly contextObjectRepository: ContextObjectRepository,
  ) {}

  async getProjectOverview(input: AiQuestionDataInput) {
    const projectGold = await this.getProjectGoldSummary(input);
    if (projectGold) return { projectGold, preferredScope: 'PROJECT' };
    return this.sourceIsAppsFlyer(input) ? { ...(await this.appsFlyerEventsRepository.getOverview(input.projectId)), projectGoldStatus: 'NOT_COMPUTED', message: 'Project-level analysis has not been computed yet.' } : { projectId: input.projectId, source: input.source, warnings: ['No adapter for this source yet.'] };
  }
  async getProjectGoldSummary(input: AiQuestionDataInput) {
    if (input.importId) return null;
    const run = await this.projectAnalysisRunRepository.getLatestCompleted(input.projectId, { source: input.source ?? 'appsflyer', dateRangeStart: input.dateRange?.from, dateRangeEnd: input.dateRange?.to });
    return run?.metadata?.summary ? { ...(run.metadata.summary as Record<string, unknown>), analysisRunId: run.id } : null;
  }
  async getImportSummary(input: AiQuestionDataInput) { return input.importId ? this.dataImportsReaderRepository.getAppsFlyerImportSummary(input.projectId, input.importId) : null; }
  async getTopFacts(input: AiQuestionDataInput) {
    const scope = input.importId ? undefined : 'PROJECT';
    const projectFacts = await this.detectedFactRepository.listByProject(input.projectId, { source: input.source, reportType: input.reportType, importId: input.importId, scope });
    if (!input.importId && projectFacts.length === 0) return [{ factType: 'PROJECT_ANALYSIS_NOT_COMPUTED', severity: 'WARNING', metricsSummary: { suggestedJob: 'recompute-project-gold' }, recommendationHint: 'Project-level analysis has not been computed yet.' } as any];
    return projectFacts.slice(0, input.limit ?? 20);
  }
  async getRecommendations(input: AiQuestionDataInput) { return (await this.recommendationRepository.listByProject(input.projectId, { source: input.source, reportType: input.reportType, importId: input.importId, scope: input.importId ? undefined : 'PROJECT' })).slice(0, input.limit ?? 10); }
  async getLatestReports(input: AiQuestionDataInput) { return (await this.aiReportRepository.listByProject(input.projectId, { source: input.source, reportType: input.reportType, importId: input.importId, scope: input.importId ? undefined : 'PROJECT' })).slice(0, input.limit ?? 3); }
  async getEventsByName(input: AiQuestionDataInput) { return this.sourceIsAppsFlyer(input) ? this.appsFlyerEventsRepository.getEventsByName(input.projectId, { importId: input.importId, reportType: input.reportType, from: input.dateRange?.from, to: input.dateRange?.to, trafficScope: 'valid' }) : []; }
  async getEntityPerformance(input: AiQuestionDataInput) { const gold = await this.getProjectGoldSummary(input); return gold ? (gold as any).mediaSourceQuality : this.sourceIsAppsFlyer(input) ? this.appsFlyerEventsRepository.getMediaSourceQuality(input.projectId, { trafficScope: 'valid', limit: input.limit }) : []; }
  async getCampaignPerformance(input: AiQuestionDataInput) { return this.sourceIsAppsFlyer(input) ? this.appsFlyerEventsRepository.getCampaignQuality(input.projectId, { trafficScope: 'valid', limit: input.limit }) : []; }
  async getEventDictionaryCoverage(input: AiQuestionDataInput) { return this.sourceIsAppsFlyer(input) ? this.appsFlyerEventsRepository.getEventDictionaryCoverage(input.projectId, { from: input.dateRange?.from, to: input.dateRange?.to }) : {}; }
  async getDataQuality(input: AiQuestionDataInput) { return this.sourceIsAppsFlyer(input) ? this.appsFlyerEventsRepository.getDataQuality(input.projectId, { from: input.dateRange?.from, to: input.dateRange?.to }) : {}; }
  async getBlockedTraffic(input: AiQuestionDataInput) { const gold = await this.getProjectGoldSummary(input); return gold ? (gold as any).blockedTraffic : this.sourceIsAppsFlyer(input) ? this.appsFlyerEventsRepository.getBlockedTraffic(input.projectId) : {}; }
  async getSemanticEntities(input: AiQuestionDataInput) { return (await this.semanticEntityRepository.searchEntities(input.projectId, { source: input.source, importId: input.importId, reportType: input.reportType })).slice(0, input.limit ?? 50); }
  async getSemanticRelationships(input: AiQuestionDataInput) { return (await this.semanticRelationshipRepository.searchRelationships(input.projectId, { source: input.source, importId: input.importId, reportType: input.reportType })).slice(0, input.limit ?? 100); }
  async getContextObjects(input: AiQuestionDataInput) { return (await this.contextObjectRepository.searchContextObjects(input.projectId, { source: input.source, reportType: input.reportType })).slice(0, input.limit ?? 30); }
  async getUnavailableMetrics(input: AiQuestionDataInput) { const overview = await this.getProjectOverview(input); return (overview as any).unavailableMetrics ?? [{ metric: 'roas', reason: 'No reliable cost source is available in the bounded processed data.' }, { metric: 'cpa', reason: 'No reliable cost source is available in the bounded processed data.' }, { metric: 'cac', reason: 'No reliable cost source is available in the bounded processed data.' }]; }
  private sourceIsAppsFlyer(input: AiQuestionDataInput): boolean { return !input.source || input.source.toLowerCase() === 'appsflyer'; }
}
