import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@metrics-platform/core-infrastructure';
import { MetricsPlatformCoreApplicationModule } from '@metrics-platform/core-application';
import { ProcessorService } from './processor.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    CqrsModule,
    ScheduleModule.forRoot(), // Permite jobs programados
    DatabaseModule,
    MetricsPlatformCoreApplicationModule,
    MetricsModule,
  ],
  providers: [ProcessorService],
})
export class AppModule {}
