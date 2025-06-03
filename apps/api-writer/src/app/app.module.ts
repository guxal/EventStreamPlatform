import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule, QueueModule } from '@metrics-platform/core-infrastructure';
import { MetricsPlatformCoreApplicationModule } from '@metrics-platform/core-application';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    CqrsModule,
    DatabaseModule,
    MetricsPlatformCoreApplicationModule,
    QueueModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

