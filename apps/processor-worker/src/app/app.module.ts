import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@metrics-platform/core-infrastructure';
import { MetricsPlatformCoreApplicationModule } from '@metrics-platform/core-application';
import { ProcessorService } from './processor.service';

@Module({
  imports: [
    CqrsModule,
    ScheduleModule.forRoot(), // Permite jobs programados
    DatabaseModule,
    MetricsPlatformCoreApplicationModule,
  ],
  providers: [ProcessorService],
})
export class AppModule {}
