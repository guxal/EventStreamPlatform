import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '@metrics-platform/core-infrastructure';
import { MetricsPlatformCoreApplicationModule } from '@metrics-platform/core-application';
import { MarketingApplicationModule } from '@metrics-platform/marketing-application';
import { MarketingInfrastructureModule } from '@metrics-platform/marketing-infrastructure';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    CqrsModule,
    DatabaseModule,
    MetricsPlatformCoreApplicationModule,
    MarketingInfrastructureModule,
    MarketingApplicationModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
