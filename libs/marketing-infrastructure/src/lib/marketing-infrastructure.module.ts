import { Module } from '@nestjs/common';
import { AiReportRepository } from '../repositories/ai/ai-report.repository';
import { RecommendationRepository } from '../repositories/ai/recommendation.repository';
import { DataImportRepository } from '../repositories/file-hub/data-import.repository';
import { ProjectRepository } from '../repositories/file-hub/project.repository';
import { RawImportFileRepository } from '../repositories/file-hub/raw-import-file.repository';
import { ObjectStorageService } from '../storage/object-storage.service';

@Module({
  providers: [
    RecommendationRepository,
    AiReportRepository,
    ObjectStorageService,
    RawImportFileRepository,
    DataImportRepository,
    ProjectRepository,
  ],
  exports: [
    RecommendationRepository,
    AiReportRepository,
    ObjectStorageService,
    RawImportFileRepository,
    DataImportRepository,
    ProjectRepository,
  ],
})
export class MarketingInfrastructureModule {}
