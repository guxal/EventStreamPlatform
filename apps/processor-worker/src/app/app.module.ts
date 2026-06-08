import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@metrics-platform/core-infrastructure';
import { MetricsPlatformCoreApplicationModule } from '@metrics-platform/core-application';
import { MetricsModule } from '../metrics/metrics.module';
import { MarketingImportModule } from '../marketing/marketing-import.module';

@Module({
  imports: [
    CqrsModule,
    ScheduleModule.forRoot(), // Permite jobs programados
    DatabaseModule,
    MetricsPlatformCoreApplicationModule,
    MetricsModule,
    MarketingImportModule,
  ],
})
export class AppModule {}
