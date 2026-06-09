import { Module } from '@nestjs/common';
import { DatabaseModule } from '@metrics-platform/core-infrastructure';
import { MarketingInfrastructureModule } from '@metrics-platform/marketing-infrastructure';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [DatabaseModule, MarketingInfrastructureModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
