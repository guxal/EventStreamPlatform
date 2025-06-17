import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Importa todos tus handlers
import { CreateEventHandler } from '../handlers/create-event.handler';
import { CreateMetricHandler } from '../handlers/create-metric.handler';
import { GetMetricHandler } from '../handlers/get-metric.handler';
import { ListMetricsHandler } from '../handlers/list-metrics.handler';
import { DatabaseModule } from '@metrics-platform/core-infrastructure';
import { QueueModule } from '@metrics-platform/core-infrastructure';
import { MetricDispatcherService } from '../services/metric-dispatcher.service';
// ...otros handlers según tus archivos

const CommandHandlers = [
  CreateEventHandler,
  CreateMetricHandler,
  // ...otros command handlers
];

const QueryHandlers = [
  GetMetricHandler,
  ListMetricsHandler,
  // ...otros query handlers
];

@Module({
  imports: [CqrsModule, DatabaseModule, QueueModule],
  providers: [...CommandHandlers, ...QueryHandlers, MetricDispatcherService],
  exports: [...CommandHandlers, ...QueryHandlers, MetricDispatcherService],
})
export class MetricsPlatformCoreApplicationModule {}