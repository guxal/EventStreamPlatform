import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  GetMetricQuery,
  ListMetricsQuery,
} from '@metrics-platform/core-application';
import {
  AiReportRepository,
  AnalysisRunRepository,
  AppsFlyerEventsRepository,
  AppsFlyerSnapshotsRepository,
  DataImportsReaderRepository,
  DetectedFactRepository,
  ProcessAuditRepository,
  RecommendationRepository,
  SemanticEntityRepository,
  SemanticRelationshipRepository,
  ContextObjectRepository,
  ProjectAnalysisRunRepository,
} from '@metrics-platform/marketing-infrastructure';
import type {
  AiOutputListFilters,
  AppsFlyerEventFilters,
} from '@metrics-platform/marketing-infrastructure';
import { AiQuestionAnsweringService } from '@metrics-platform/marketing-application';
import type {
  AiChatPayload,
  CampaignRow,
  DashboardSummary,
  KeywordRow,
} from './reader.types';

@Injectable()
export class AppService {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly detectedFactRepository: DetectedFactRepository,
    private readonly recommendationRepository: RecommendationRepository,
    private readonly aiReportRepository: AiReportRepository,
    private readonly processAuditRepository: ProcessAuditRepository,
    private readonly appsFlyerEventsRepository: AppsFlyerEventsRepository,
    private readonly appsFlyerSnapshotsRepository: AppsFlyerSnapshotsRepository,
    private readonly dataImportsReaderRepository: DataImportsReaderRepository,
    private readonly semanticEntityRepository: SemanticEntityRepository,
    private readonly semanticRelationshipRepository: SemanticRelationshipRepository,
    private readonly contextObjectRepository: ContextObjectRepository,
    private readonly analysisRunRepository: AnalysisRunRepository,
    private readonly projectAnalysisRunRepository: ProjectAnalysisRunRepository,
    private readonly aiQuestionAnsweringService: AiQuestionAnsweringService,
  ) {}

  async handleGetMetric(
    metricName: string,
    period: string,
    store: 'db' | 'redis' = 'db',
  ) {
    return this.queryBus.execute(new GetMetricQuery(metricName, period, store));
  }

  async handleListMetrics(
    metricName?: string,
    fromPeriod?: string,
    toPeriod?: string,
  ) {
    return this.queryBus.execute(
      new ListMetricsQuery(metricName, fromPeriod, toPeriod),
    );
  }

  async getProjectDashboard(
    projectId: string,
    period = 'last_7_days',
  ): Promise<DashboardSummary> {
    const [appsFlyer, mediaSourceQualityRanking, campaignQualityRanking, eventDictionaryCoverage, dataQualitySummary, blockedTraffic] = await Promise.all([
      this.getAppsFlyerOverview(projectId),
      this.getAppsFlyerMediaSourceQuality(projectId, { source: 'appsflyer', limit: '10' }),
      this.getAppsFlyerCampaignQuality(projectId, { source: 'appsflyer', limit: '10' }),
      this.getAppsFlyerEventDictionaryCoverage(projectId, { source: 'appsflyer' }),
      this.getAppsFlyerDataQuality(projectId, { source: 'appsflyer' }),
      this.getAppsFlyerBlockedTraffic(projectId),
    ]);
    return {
      projectId,
      period,
      totals: {
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions:
          appsFlyer.registrations +
          appsFlyer.deposits +
          appsFlyer.firstDeposits,
        conversionValue: appsFlyer.depositAmount,
        ctr: 0,
        cpc: 0,
        cpa: 0,
        roas: 0,
      },
      appsFlyer: appsFlyer.totalEvents > 0 ? { ...appsFlyer, blockedTraffic, mediaSourceQualityRanking, campaignQualityRanking, eventDictionaryCoverage, dataQualitySummary } : undefined,
      trafficQualitySummary: { totalRawEvents: appsFlyer.totalRawEvents, totalValidEvents: appsFlyer.totalValidEvents, totalBlockedEvents: appsFlyer.totalBlockedEvents, blockedRate: appsFlyer.blockedRate, validEventRate: appsFlyer.validEventRate },
      mediaSourceQualityRanking,
      campaignQualityRanking,
      eventDictionaryCoverage,
      dataQualitySummary,
      unavailableMetrics: [{ label: 'Reliable cost source', status: 'missing', reason: 'AppsFlyer imports do not provide reliable ad cost for ROAS.' }, ...appsFlyer.unavailableMetrics],
    };
  }

  listProjectCampaigns(_projectId: string): CampaignRow[] {
    return [];
  }

  listProjectKeywords(_projectId: string): KeywordRow[] {
    return [];
  }

  async getOverview(projectId: string, filters: { source?: string } = {}) {
    if (!filters.source || filters.source.toLowerCase() === 'appsflyer')
      return this.getAppsFlyerOverview(projectId);
    return {
      projectId,
      source: filters.source,
      totalEvents: 0,
      warnings: ['No reader adapter is available for this source yet.'],
    };
  }

  async getSourceMetrics(projectId: string, filters: { source?: string } = {}) {
    return this.getOverview(projectId, filters);
  }

  async getEntitiesPerformance(
    projectId: string,
    filters: { source?: string; trafficScope?: 'valid' | 'blocked' | 'all'; includeBlocked?: string } = {},
  ) {
    if (!filters.source || filters.source.toLowerCase() === 'appsflyer')
      return this.getAppsFlyerCampaigns(projectId, { trafficScope: filters.trafficScope ?? (filters.includeBlocked === 'true' ? 'all' : 'valid') });
    return [];
  }

  async getAppsFlyerOverview(projectId: string) {
    return this.appsFlyerEventsRepository.getOverview(projectId);
  }

  async getAppsFlyerImportSummary(projectId: string, importId: string) {
    const [summary, kpiSnapshot] = await Promise.all([
      this.dataImportsReaderRepository.getAppsFlyerImportSummary(
        projectId,
        importId,
      ),
      this.appsFlyerSnapshotsRepository.getLatestByImport(projectId, importId),
    ]);
    if (!summary)
      throw new NotFoundException(
        `Import ${importId} not found for project ${projectId}`,
      );
    return { ...summary, kpiSnapshot };
  }

  async getAppsFlyerEventsByName(
    projectId: string,
    filters: AppsFlyerEventFilters = {},
  ) {
    return this.appsFlyerEventsRepository.getEventsByName(projectId, { ...filters, trafficScope: filters.trafficScope ?? 'valid' });
  }

  async getAppsFlyerMediaSources(projectId: string, filters: AppsFlyerEventFilters = {}) {
    return this.appsFlyerEventsRepository.getMediaSources(projectId, { ...filters, trafficScope: filters.trafficScope ?? 'valid' });
  }

  async getAppsFlyerCampaigns(projectId: string, filters: AppsFlyerEventFilters = {}) {
    return this.appsFlyerEventsRepository.getCampaigns(projectId, { ...filters, trafficScope: filters.trafficScope ?? 'valid' });
  }

  async getAppsFlyerMediaSourceQuality(projectId: string, filters: { source?: string; dateRangeStart?: string; dateRangeEnd?: string; trafficScope?: 'valid' | 'all'; limit?: string } = {}) {
    if (filters.source && filters.source.toLowerCase() !== 'appsflyer') return [];
    return this.appsFlyerEventsRepository.getMediaSourceQuality(projectId, { from: filters.dateRangeStart, to: filters.dateRangeEnd, trafficScope: filters.trafficScope ?? 'valid', limit: filters.limit ? Number(filters.limit) : undefined });
  }

  async getAppsFlyerCampaignQuality(projectId: string, filters: { source?: string; dateRangeStart?: string; dateRangeEnd?: string; trafficScope?: 'valid' | 'all'; limit?: string } = {}) {
    if (filters.source && filters.source.toLowerCase() !== 'appsflyer') return [];
    return this.appsFlyerEventsRepository.getCampaignQuality(projectId, { from: filters.dateRangeStart, to: filters.dateRangeEnd, trafficScope: filters.trafficScope ?? 'valid', limit: filters.limit ? Number(filters.limit) : undefined });
  }

  async getAppsFlyerEventDictionaryCoverage(projectId: string, filters: { source?: string; dateRangeStart?: string; dateRangeEnd?: string } = {}) {
    if (filters.source && filters.source.toLowerCase() !== 'appsflyer') return {};
    return this.appsFlyerEventsRepository.getEventDictionaryCoverage(projectId, { from: filters.dateRangeStart, to: filters.dateRangeEnd });
  }

  async getAppsFlyerDataQuality(projectId: string, filters: { source?: string; dateRangeStart?: string; dateRangeEnd?: string } = {}) {
    if (filters.source && filters.source.toLowerCase() !== 'appsflyer') return {};
    return this.appsFlyerEventsRepository.getDataQuality(projectId, { from: filters.dateRangeStart, to: filters.dateRangeEnd });
  }

  async getAppsFlyerBlockedTraffic(projectId: string) {
    return this.appsFlyerEventsRepository.getBlockedTraffic(projectId);
  }

  async getProjectAnalysisSummary(projectId: string, filters: { source?: string; dateRangeStart?: string; dateRangeEnd?: string } = {}) {
    const run = await this.projectAnalysisRunRepository.getLatestCompleted(projectId, { source: filters.source ?? 'appsflyer', dateRangeStart: filters.dateRangeStart, dateRangeEnd: filters.dateRangeEnd });
    if (!run) return { projectId, source: filters.source ?? 'appsflyer', status: 'NOT_COMPUTED', message: 'Project-level analysis has not been computed yet.', suggestedAction: 'Run recompute-project-gold.' };
    const summary = (run.metadata?.summary ?? {}) as Record<string, unknown>;
    return { ...summary, analysisRun: run };
  }

  async getProjectAnalysisFunnel(projectId: string, filters: { source?: string; dateRangeStart?: string; dateRangeEnd?: string } = {}) {
    const summary = await this.getProjectAnalysisSummary(projectId, filters);
    return { projectId, source: filters.source ?? 'appsflyer', periodFunnel: (summary as any).periodFunnel, cohortFunnel: (summary as any).cohortFunnel, dataAvailability: (summary as any).dataAvailability, status: (summary as any).status };
  }

  async getProjectAnalysisMediaSources(projectId: string, filters: { source?: string; dateRangeStart?: string; dateRangeEnd?: string } = {}) {
    const summary = await this.getProjectAnalysisSummary(projectId, filters);
    return { projectId, source: filters.source ?? 'appsflyer', mediaSourceQuality: (summary as any).mediaSourceQuality, status: (summary as any).status };
  }

  async listProjectFacts(
    projectId: string,
    filters: {
      source?: string;
      reportType?: string;
      includeSemantic?: string;
      scope?: string;
    } = {},
  ) {
    const facts = await this.detectedFactRepository.listByProject(
      projectId,
      filters,
    );
    if (filters.includeSemantic !== 'true') return facts;
    return {
      data: facts,
      semantic: await this.getSemanticBundle(projectId, {
        source: filters.source,
        reportType: filters.reportType,
      }),
    };
  }

  async listProjectRecommendations(
    projectId: string,
    filters: AiOutputListFilters & { includeSemantic?: string } = {},
  ) {
    const recommendations = await this.recommendationRepository.listByProject(
      projectId,
      filters,
    );
    if (filters.includeSemantic !== 'true') return recommendations;
    return {
      data: recommendations,
      semantic: await this.getSemanticBundle(projectId, {
        source: filters.source,
        reportType: filters.reportType,
      }),
    };
  }

  async listProjectReports(
    projectId: string,
    filters: AiOutputListFilters & { includeSemantic?: string } = {},
  ) {
    const reports = await this.aiReportRepository.listByProject(
      projectId,
      filters,
    );
    if (filters.includeSemantic !== 'true') return reports;
    return {
      data: reports,
      semantic: await this.getSemanticBundle(projectId, {
        source: filters.source,
        reportType: filters.reportType,
      }),
    };
  }

  async listSemanticEntities(
    projectId: string,
    filters: {
      source?: string;
      entityType?: string;
      canonicalName?: string;
      importId?: string;
      reportType?: string;
    } = {},
  ) {
    return this.semanticEntityRepository.searchEntities(projectId, filters);
  }

  async listSemanticRelationships(
    projectId: string,
    filters: {
      source?: string;
      relationshipType?: string;
      sourceEntityId?: string;
      targetEntityId?: string;
      importId?: string;
      reportType?: string;
    } = {},
  ) {
    return this.semanticRelationshipRepository.searchRelationships(
      projectId,
      filters,
    );
  }

  async listContextObjects(
    projectId: string,
    filters: {
      source?: string;
      contextType?: string;
      entityId?: string;
      reportType?: string;
      validAt?: string;
    } = {},
  ) {
    return this.contextObjectRepository.searchContextObjects(
      projectId,
      filters,
    );
  }

  private async getSemanticBundle(
    projectId: string,
    filters: { source?: string; reportType?: string } = {},
  ) {
    const [entities, relationships, contextObjects] = await Promise.all([
      this.semanticEntityRepository.searchEntities(projectId, filters),
      this.semanticRelationshipRepository.searchRelationships(
        projectId,
        filters,
      ),
      this.contextObjectRepository.searchContextObjects(projectId, filters),
    ]);
    return { entities, relationships, contextObjects };
  }

  async listProjectProcesses(projectId: string, limit?: string) {
    return this.processAuditRepository.listRunsByProject(
      projectId,
      limit ? Number(limit) : 50,
    );
  }

  async getProjectProcess(projectId: string, runId: string) {
    const run = await this.processAuditRepository.getRunWithSteps(
      projectId,
      runId,
    );
    if (!run)
      throw new NotFoundException(
        `Process run ${runId} not found for project ${projectId}`,
      );
    return run;
  }

  async getImportFlow(projectId: string, importId: string) {
    const run = await this.processAuditRepository.getLatestRunByImport(
      projectId,
      importId,
    );
    if (!run)
      throw new NotFoundException(
        `No process run found for import ${importId}`,
      );
    return run;
  }

  async listAnalysisRuns(
    projectId: string,
    filters: {
      source?: string;
      reportType?: string;
      importId?: string;
      status?: string;
      analysisType?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    return this.analysisRunRepository.findByProject(projectId, filters);
  }

  async getAnalysisRun(projectId: string, analysisRunId: string) {
    const run = await this.analysisRunRepository.findById(
      projectId,
      analysisRunId,
    );
    if (!run)
      throw new NotFoundException(
        `Analysis run ${analysisRunId} not found for project ${projectId}`,
      );
    return run;
  }

  async askQuestion(
    projectId: string,
    payload: {
      question?: string;
      query?: string;
      source?: string;
      reportType?: string;
      importId?: string;
      dateRange?: { from?: string; to?: string };
      provider?: string;
      model?: string;
      correlationId?: string;
    },
  ) {
    return this.aiQuestionAnsweringService.answer({
      projectId,
      question: payload.question ?? payload.query ?? '',
      source: payload.source,
      reportType: payload.reportType,
      importId: payload.importId,
      dateRange: payload.dateRange,
      provider: payload.provider,
      model: payload.model,
      correlationId: payload.correlationId,
    });
  }

  async askAiChat(projectId: string, payload: AiChatPayload) {
    const result = await this.askQuestion(projectId, {
      question: payload.question ?? payload.query,
      source: payload.source,
      reportType: payload.reportType,
      importId: payload.importId,
      dateRange: payload.dateRange,
      provider: payload.provider,
      model: payload.model,
      correlationId: payload.correlationId,
    });
    return {
      ...result,
      query: payload.query ?? payload.question,
      response: result.answer,
    };
  }
}
