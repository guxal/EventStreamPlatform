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

  @Get('projects/:id/campaigns')
  listCampaigns(@Param('id') projectId: string) {
    return this.appService.listProjectCampaigns(projectId);
  }

  @Get('projects/:id/keywords')
  listKeywords(@Param('id') projectId: string) {
    return this.appService.listProjectKeywords(projectId);
  }

  @Get('projects/:id/facts')
  listFacts(@Param('id') projectId: string) {
    return this.appService.listProjectFacts(projectId);
  }

  @Get('projects/:id/recommendations')
  listRecommendations(@Param('id') projectId: string) {
    return this.appService.listProjectRecommendations(projectId);
  }

  @Get('projects/:id/reports')
  listReports(@Param('id') projectId: string) {
    return this.appService.listProjectReports(projectId);
  }

  @Post('projects/:id/ai-chat')
  askAiChat(@Param('id') projectId: string, @Body() payload: AiChatPayload) {
    return this.appService.askAiChat(projectId, payload);
  }
}
