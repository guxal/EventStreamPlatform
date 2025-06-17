import { Controller, Get, Param, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('metrics')
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET /metrics/:metricName?period=2025-05
  @Get(':metricName')
  async getMetric(
    @Param('metricName') metricName: string,
    @Query('period') period: string,
    @Query('store') store: 'db' | 'redis' = 'db', // Default to 'db'
  ) {
    return this.appService.handleGetMetric(metricName, period, store);
  }

  // GET /metrics?metricName=DAU&fromPeriod=2025-05-01&toPeriod=2025-05-27
  @Get()
  async listMetrics(
    @Query('metricName') metricName?: string,
    @Query('fromPeriod') fromPeriod?: string,
    @Query('toPeriod') toPeriod?: string,
  ) {
    return this.appService.handleListMetrics(metricName, fromPeriod, toPeriod);
  }
}
