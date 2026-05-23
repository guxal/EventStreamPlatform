import { Module } from '@nestjs/common';
import { AiReportRepository } from '../repositories/ai/ai-report.repository';
import { RecommendationRepository } from '../repositories/ai/recommendation.repository';
import { ObjectStorageService } from '../storage/object-storage.service';

@Module({
  providers: [RecommendationRepository, AiReportRepository, ObjectStorageService],
  exports: [RecommendationRepository, AiReportRepository, ObjectStorageService],
})
export class MarketingInfrastructureModule {}
