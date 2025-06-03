// metrics/metrics.module.ts
import { Module } from '@nestjs/common';
import { MetricsOrchestratorService } from './metrics-orchestrator.service';
import { CronManager } from '../cron/cron.manager'; // <- lo importas aquí
import { DAUMetricPlugin } from './plugins/dau.metric';
import { DatabaseModule } from '@metrics-platform/core-infrastructure';

@Module({
  imports: [DatabaseModule],
  providers: [MetricsOrchestratorService, CronManager, DAUMetricPlugin],
  exports: [MetricsOrchestratorService],
})
export class MetricsModule {}
