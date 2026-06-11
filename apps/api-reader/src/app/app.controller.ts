import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import type { AiChatPayload } from './reader.types';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('metrics/:metricName')
  async getMetric(
    @Param('metricName') metricName: string,
    @Query('period') period: string,
    @Query('store') store: 'db' | 'redis' = 'db',
  ) {
    return this.appService.handleGetMetric(metricName, period, store);
  }

  @Get('metrics')
  async listMetrics(
    @Query('metricName') metricName?: string,
    @Query('fromPeriod') fromPeriod?: string,
    @Query('toPeriod') toPeriod?: string,
  ) {
    return this.appService.handleListMetrics(metricName, fromPeriod, toPeriod);
  }

  @Get('projects/:id/dashboard')
  getDashboard(@Param('id') projectId: string, @Query('period') period?: string) {
    return this.appService.getProjectDashboard(projectId, period);
  }

  @Get('projects/:id/overview')
  getOverview(@Param('id') projectId: string, @Query('source') source?: string) {
    return this.appService.getOverview(projectId, { source });
  }

  @Get('projects/:id/metrics')
  getSourceMetrics(@Param('id') projectId: string, @Query('source') source?: string) {
    return this.appService.getSourceMetrics(projectId, { source });
  }

  @Get('projects/:id/entities/performance')
  getEntitiesPerformance(@Param('id') projectId: string, @Query('source') source?: string) {
    return this.appService.getEntitiesPerformance(projectId, { source });
  }

  @Get('projects/:id/events/by-name')
  getEventsByName(
    @Param('id') projectId: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('importId') importId?: string,
    @Query('import_id') import_id?: string,
    @Query('reportType') reportType?: string,
    @Query('report_type') report_type?: string,
  ) {
    if (source && source.toLowerCase() !== 'appsflyer') return [];
    return this.appService.getAppsFlyerEventsByName(projectId, { from, to, importId: importId ?? import_id, reportType: reportType ?? report_type });
  }

  @Get('projects/:id/traffic-quality/blocked')
  getBlockedTraffic(@Param('id') projectId: string, @Query('source') source?: string) {
    if (source && source.toLowerCase() !== 'appsflyer') return {};
    return this.appService.getAppsFlyerBlockedTraffic(projectId);
  }


  @Get('projects/:id/appsflyer/overview')
  getAppsFlyerOverview(@Param('id') projectId: string) {
    return this.appService.getAppsFlyerOverview(projectId);
  }

  @Get('projects/:id/appsflyer/imports/:importId/summary')
  getAppsFlyerImportSummary(@Param('id') projectId: string, @Param('importId') importId: string) {
    return this.appService.getAppsFlyerImportSummary(projectId, importId);
  }

  @Get('projects/:id/appsflyer/events/by-name')
  getAppsFlyerEventsByName(
    @Param('id') projectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('importId') importId?: string,
    @Query('import_id') import_id?: string,
    @Query('reportType') reportType?: string,
    @Query('report_type') report_type?: string,
    @Query('mediaSource') mediaSource?: string,
    @Query('media_source') media_source?: string,
    @Query('campaignName') campaignName?: string,
    @Query('campaign_name') campaign_name?: string,
    @Query('canonicalEventName') canonicalEventName?: string,
    @Query('canonical_event_name') canonical_event_name?: string,
  ) {
    return this.appService.getAppsFlyerEventsByName(projectId, {
      from,
      to,
      importId: importId ?? import_id,
      reportType: reportType ?? report_type,
      mediaSource: mediaSource ?? media_source,
      campaignName: campaignName ?? campaign_name,
      canonicalEventName: canonicalEventName ?? canonical_event_name,
    });
  }

  @Get('projects/:id/appsflyer/media-sources')
  getAppsFlyerMediaSources(@Param('id') projectId: string) {
    return this.appService.getAppsFlyerMediaSources(projectId);
  }

  @Get('projects/:id/appsflyer/campaigns')
  getAppsFlyerCampaigns(@Param('id') projectId: string) {
    return this.appService.getAppsFlyerCampaigns(projectId);
  }

  @Get('projects/:id/appsflyer/blocked-traffic')
  getAppsFlyerBlockedTraffic(@Param('id') projectId: string) {
    return this.appService.getAppsFlyerBlockedTraffic(projectId);
  }

  @Get('projects/:id/campaigns')
  listCampaigns(@Param('id') projectId: string) {
    return this.appService.listProjectCampaigns(projectId);
  }

  @Get('projects/:id/keywords')
  listKeywords(@Param('id') projectId: string) {
    return this.appService.listProjectKeywords(projectId);
  }

  @Get('projects/:id/facts')
  listFacts(@Param('id') projectId: string, @Query('source') source?: string, @Query('reportType') reportType?: string, @Query('report_type') report_type?: string, @Query('includeSemantic') includeSemantic?: string, @Query('include_semantic') include_semantic?: string) {
    return this.appService.listProjectFacts(projectId, { source, reportType: reportType ?? report_type, includeSemantic: includeSemantic ?? include_semantic });
  }

  @Get('projects/:id/recommendations')
  listRecommendations(
    @Param('id') projectId: string,
    @Query('source') source?: string,
    @Query('reportType') reportType?: string,
    @Query('report_type') report_type?: string,
    @Query('importId') importId?: string,
    @Query('import_id') import_id?: string,
    @Query('priority') priority?: string,
    @Query('generationStatus') generationStatus?: string,
    @Query('generation_status') generation_status?: string,
    @Query('factType') factType?: string,
    @Query('fact_type') fact_type?: string,
    @Query('entityType') entityType?: string,
    @Query('entity_type') entity_type?: string,
    @Query('entityId') entityId?: string,
    @Query('entity_id') entity_id?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('analysisRunId') analysisRunId?: string,
    @Query('analysis_run_id') analysis_run_id?: string,
    @Query('includeSemantic') includeSemantic?: string,
    @Query('include_semantic') include_semantic?: string,
  ) {
    return this.appService.listProjectRecommendations(projectId, {
      source,
      reportType: reportType ?? report_type,
      importId: importId ?? import_id,
      priority,
      generationStatus: generationStatus ?? generation_status,
      factType: factType ?? fact_type,
      entityType: entityType ?? entity_type,
      entityId: entityId ?? entity_id,
      from,
      to,
      analysisRunId: analysisRunId ?? analysis_run_id,
      includeSemantic: includeSemantic ?? include_semantic,
    });
  }

  @Get('projects/:id/reports')
  listReports(
    @Param('id') projectId: string,
    @Query('source') source?: string,
    @Query('reportType') reportType?: string,
    @Query('report_type') report_type?: string,
    @Query('importId') importId?: string,
    @Query('import_id') import_id?: string,
    @Query('generationStatus') generationStatus?: string,
    @Query('generation_status') generation_status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('analysisRunId') analysisRunId?: string,
    @Query('analysis_run_id') analysis_run_id?: string,
    @Query('includeSemantic') includeSemantic?: string,
    @Query('include_semantic') include_semantic?: string,
  ) {
    return this.appService.listProjectReports(projectId, {
      source,
      reportType: reportType ?? report_type,
      importId: importId ?? import_id,
      generationStatus: generationStatus ?? generation_status,
      from,
      to,
      analysisRunId: analysisRunId ?? analysis_run_id,
      includeSemantic: includeSemantic ?? include_semantic,
    });
  }

  @Get('projects/:id/semantic/entities')
  listSemanticEntities(
    @Param('id') projectId: string,
    @Query('source') source?: string,
    @Query('entityType') entityType?: string,
    @Query('entity_type') entity_type?: string,
    @Query('canonicalName') canonicalName?: string,
    @Query('canonical_name') canonical_name?: string,
    @Query('importId') importId?: string,
    @Query('import_id') import_id?: string,
    @Query('reportType') reportType?: string,
    @Query('report_type') report_type?: string,
  ) {
    return this.appService.listSemanticEntities(projectId, { source, entityType: entityType ?? entity_type, canonicalName: canonicalName ?? canonical_name, importId: importId ?? import_id, reportType: reportType ?? report_type });
  }

  @Get('projects/:id/semantic/relationships')
  listSemanticRelationships(
    @Param('id') projectId: string,
    @Query('source') source?: string,
    @Query('relationshipType') relationshipType?: string,
    @Query('relationship_type') relationship_type?: string,
    @Query('sourceEntityId') sourceEntityId?: string,
    @Query('source_entity_id') source_entity_id?: string,
    @Query('targetEntityId') targetEntityId?: string,
    @Query('target_entity_id') target_entity_id?: string,
    @Query('importId') importId?: string,
    @Query('import_id') import_id?: string,
    @Query('reportType') reportType?: string,
    @Query('report_type') report_type?: string,
  ) {
    return this.appService.listSemanticRelationships(projectId, { source, relationshipType: relationshipType ?? relationship_type, sourceEntityId: sourceEntityId ?? source_entity_id, targetEntityId: targetEntityId ?? target_entity_id, importId: importId ?? import_id, reportType: reportType ?? report_type });
  }

  @Get('projects/:id/context')
  listContextObjects(
    @Param('id') projectId: string,
    @Query('source') source?: string,
    @Query('contextType') contextType?: string,
    @Query('context_type') context_type?: string,
    @Query('entityId') entityId?: string,
    @Query('entity_id') entity_id?: string,
    @Query('reportType') reportType?: string,
    @Query('report_type') report_type?: string,
    @Query('validAt') validAt?: string,
    @Query('valid_at') valid_at?: string,
  ) {
    return this.appService.listContextObjects(projectId, { source, contextType: contextType ?? context_type, entityId: entityId ?? entity_id, reportType: reportType ?? report_type, validAt: validAt ?? valid_at });
  }

  @Get('projects/:id/analysis-runs')
  listAnalysisRuns(
    @Param('id') projectId: string,
    @Query('source') source?: string,
    @Query('reportType') reportType?: string,
    @Query('report_type') report_type?: string,
    @Query('importId') importId?: string,
    @Query('import_id') import_id?: string,
    @Query('status') status?: string,
    @Query('analysisType') analysisType?: string,
    @Query('analysis_type') analysis_type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.appService.listAnalysisRuns(projectId, { source, reportType: reportType ?? report_type, importId: importId ?? import_id, status, analysisType: analysisType ?? analysis_type, from, to });
  }

  @Get('projects/:id/analysis-runs/:analysisRunId')
  getAnalysisRun(@Param('id') projectId: string, @Param('analysisRunId') analysisRunId: string) {
    return this.appService.getAnalysisRun(projectId, analysisRunId);
  }

  @Get('projects/:id/processes')
  listProcesses(@Param('id') projectId: string, @Query('limit') limit?: string) {
    return this.appService.listProjectProcesses(projectId, limit);
  }

  @Get('projects/:id/processes/:runId')
  getProcess(@Param('id') projectId: string, @Param('runId') runId: string) {
    return this.appService.getProjectProcess(projectId, runId);
  }

  @Get('projects/:id/imports/:importId/flow')
  getImportFlow(@Param('id') projectId: string, @Param('importId') importId: string) {
    return this.appService.getImportFlow(projectId, importId);
  }

  @Post('projects/:id/questions')
  askQuestion(@Param('id') projectId: string, @Body() payload: AiChatPayload) {
    return this.appService.askQuestion(projectId, payload);
  }

  @Post('projects/:id/ai-chat')
  askAiChat(@Param('id') projectId: string, @Body() payload: AiChatPayload) {
    return this.appService.askAiChat(projectId, payload);
  }
}
