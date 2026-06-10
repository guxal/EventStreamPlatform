import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetMetricQuery, ListMetricsQuery } from '@metrics-platform/core-application';
import {
  AiReportRepository,
  AppsFlyerEventsRepository,
  AppsFlyerSnapshotsRepository,
  DataImportsReaderRepository,
  DetectedFactRepository,
  ProcessAuditRepository,
  RecommendationRepository,
  SemanticEntityRepository,
  SemanticRelationshipRepository,
  ContextObjectRepository,
} from '@metrics-platform/marketing-infrastructure';
import type { AiOutputListFilters, AppsFlyerEventFilters } from '@metrics-platform/marketing-infrastructure';
import type { AiChatPayload, CampaignRow, DashboardSummary, KeywordRow } from './reader.types';

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
  ) {}

  async handleGetMetric(metricName: string, period: string, store: 'db' | 'redis' = 'db') {
    return this.queryBus.execute(new GetMetricQuery(metricName, period, store));
  }

  async handleListMetrics(metricName?: string, fromPeriod?: string, toPeriod?: string) {
    return this.queryBus.execute(new ListMetricsQuery(metricName, fromPeriod, toPeriod));
  }

  async getProjectDashboard(projectId: string, period = 'last_7_days'): Promise<DashboardSummary> {
    const appsFlyer = await this.getAppsFlyerOverview(projectId);
    return {
      projectId,
      period,
      totals: {
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: appsFlyer.registrations + appsFlyer.deposits + appsFlyer.firstDeposits,
        conversionValue: appsFlyer.depositAmount,
        ctr: 0,
        cpc: 0,
        cpa: 0,
        roas: 0,
      },
      appsFlyer: appsFlyer.totalEvents > 0 ? appsFlyer : undefined,
      unavailableMetrics: appsFlyer.unavailableMetrics,
    };
  }

  listProjectCampaigns(_projectId: string): CampaignRow[] {
    return [];
  }

  listProjectKeywords(_projectId: string): KeywordRow[] {
    return [];
  }

  async getOverview(projectId: string, filters: { source?: string } = {}) {
    if (!filters.source || filters.source.toLowerCase() === 'appsflyer') return this.getAppsFlyerOverview(projectId);
    return { projectId, source: filters.source, totalEvents: 0, warnings: ['No reader adapter is available for this source yet.'] };
  }

  async getSourceMetrics(projectId: string, filters: { source?: string } = {}) {
    return this.getOverview(projectId, filters);
  }

  async getEntitiesPerformance(projectId: string, filters: { source?: string } = {}) {
    if (!filters.source || filters.source.toLowerCase() === 'appsflyer') return this.getAppsFlyerCampaigns(projectId);
    return [];
  }

  async getAppsFlyerOverview(projectId: string) {
    return this.appsFlyerEventsRepository.getOverview(projectId);
  }

  async getAppsFlyerImportSummary(projectId: string, importId: string) {
    const [summary, kpiSnapshot] = await Promise.all([
      this.dataImportsReaderRepository.getAppsFlyerImportSummary(projectId, importId),
      this.appsFlyerSnapshotsRepository.getLatestByImport(projectId, importId),
    ]);
    if (!summary) throw new NotFoundException(`Import ${importId} not found for project ${projectId}`);
    return { ...summary, kpiSnapshot };
  }

  async getAppsFlyerEventsByName(projectId: string, filters: AppsFlyerEventFilters = {}) {
    return this.appsFlyerEventsRepository.getEventsByName(projectId, filters);
  }

  async getAppsFlyerMediaSources(projectId: string) {
    return this.appsFlyerEventsRepository.getMediaSources(projectId);
  }

  async getAppsFlyerCampaigns(projectId: string) {
    return this.appsFlyerEventsRepository.getCampaigns(projectId);
  }

  async getAppsFlyerBlockedTraffic(projectId: string) {
    return this.appsFlyerEventsRepository.getBlockedTraffic(projectId);
  }

  async listProjectFacts(projectId: string, filters: { source?: string; reportType?: string; includeSemantic?: string } = {}) {
    const facts = await this.detectedFactRepository.listByProject(projectId, filters);
    if (filters.includeSemantic !== 'true') return facts;
    return { data: facts, semantic: await this.getSemanticBundle(projectId, { source: filters.source, reportType: filters.reportType }) };
  }

  async listProjectRecommendations(projectId: string, filters: AiOutputListFilters & { includeSemantic?: string } = {}) {
    const recommendations = await this.recommendationRepository.listByProject(projectId, filters);
    if (filters.includeSemantic !== 'true') return recommendations;
    return { data: recommendations, semantic: await this.getSemanticBundle(projectId, { source: filters.source, reportType: filters.reportType }) };
  }

  async listProjectReports(projectId: string, filters: AiOutputListFilters & { includeSemantic?: string } = {}) {
    const reports = await this.aiReportRepository.listByProject(projectId, filters);
    if (filters.includeSemantic !== 'true') return reports;
    return { data: reports, semantic: await this.getSemanticBundle(projectId, { source: filters.source, reportType: filters.reportType }) };
  }

  async listSemanticEntities(projectId: string, filters: { source?: string; entityType?: string; canonicalName?: string; importId?: string; reportType?: string } = {}) {
    return this.semanticEntityRepository.searchEntities(projectId, filters);
  }

  async listSemanticRelationships(projectId: string, filters: { source?: string; relationshipType?: string; sourceEntityId?: string; targetEntityId?: string; importId?: string; reportType?: string } = {}) {
    return this.semanticRelationshipRepository.searchRelationships(projectId, filters);
  }

  async listContextObjects(projectId: string, filters: { source?: string; contextType?: string; entityId?: string; reportType?: string; validAt?: string } = {}) {
    return this.contextObjectRepository.searchContextObjects(projectId, filters);
  }

  private async getSemanticBundle(projectId: string, filters: { source?: string; reportType?: string } = {}) {
    const [entities, relationships, contextObjects] = await Promise.all([
      this.semanticEntityRepository.searchEntities(projectId, filters),
      this.semanticRelationshipRepository.searchRelationships(projectId, filters),
      this.contextObjectRepository.searchContextObjects(projectId, filters),
    ]);
    return { entities, relationships, contextObjects };
  }

  async listProjectProcesses(projectId: string, limit?: string) {
    return this.processAuditRepository.listRunsByProject(projectId, limit ? Number(limit) : 50);
  }

  async getProjectProcess(projectId: string, runId: string) {
    const run = await this.processAuditRepository.getRunWithSteps(projectId, runId);
    if (!run) throw new NotFoundException(`Process run ${runId} not found for project ${projectId}`);
    return run;
  }

  async getImportFlow(projectId: string, importId: string) {
    const run = await this.processAuditRepository.getLatestRunByImport(projectId, importId);
    if (!run) throw new NotFoundException(`No process run found for import ${importId}`);
    return run;
  }

  async askAiChat(projectId: string, payload: AiChatPayload) {
    const facts = await this.detectedFactRepository.listByProject(projectId);
    if (facts.length === 0) {
      return {
        projectId,
        query: payload.query,
        response: 'No hay facts detectados para este proyecto todavía. Sube y procesa un archivo antes de pedir recomendaciones.',
        source: 'facts-first',
      };
    }

    const topFact = facts[0];
    return {
      projectId,
      query: payload.query,
      response: `Basado solo en facts detectados, el principal hallazgo es ${topFact.factType} con severidad ${topFact.severity}. ${topFact.recommendationHint ?? 'Revisa el detalle del fact antes de tomar acción.'}`,
      source: 'facts-first',
      fact: topFact,
    };
  }
}
