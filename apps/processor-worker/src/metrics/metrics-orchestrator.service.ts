import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core'; // IMPORTANTE
import { METRICS_CONFIG } from './metrics.config';
import { startQueueConsumer } from '../queue/queue.consumer';
import { CronManager } from '../cron/cron.manager';

@Injectable()
export class MetricsOrchestratorService implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,  // Para DI manual
    private readonly cronManager: CronManager
  ) {}

  onModuleInit() {
    for (const metric of METRICS_CONFIG) {
      if (!metric.enabled) continue;

      // Batch/hybrid
      if (metric.mode === 'batch' || metric.mode === 'hybrid') {
        if (!metric.schedule) continue;
        this.cronManager.registerJob(
          metric.name,
          metric.schedule,
          async () => {
            const pluginInstance = this.moduleRef.get(metric.plugin, { strict: false });
            if (pluginInstance && typeof pluginInstance[metric.method] === 'function') {
              await pluginInstance[metric.method]();
            }
          }
        );
      }

      // Realtime/hybrid
      if (metric.mode === 'realtime' || metric.mode === 'hybrid') {
        if (!metric.queue) continue;
        startQueueConsumer(metric.queue, async (event) => {
          const pluginInstance = this.moduleRef.get(metric.plugin, { strict: false });
          if (pluginInstance && typeof pluginInstance[metric.method] === 'function') {
            await pluginInstance[metric.method](event);
          }
        });
      }
    }
  }
}
