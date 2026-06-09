import { Module } from '@nestjs/common';
import { AiReportRepository } from '../repositories/ai/ai-report.repository';
import { RecommendationRepository } from '../repositories/ai/recommendation.repository';
import { AppsFlyerEventsRepository } from '../repositories/appsflyer/appsflyer-events.repository';
import { AppsFlyerSnapshotsRepository } from '../repositories/appsflyer/appsflyer-snapshots.repository';
import { DataImportRepository } from '../repositories/file-hub/data-import.repository';
import { ProjectRepository } from '../repositories/file-hub/project.repository';
import { RawImportFileRepository } from '../repositories/file-hub/raw-import-file.repository';
import { ClickHouseMarketingRepository } from '../repositories/marketing/clickhouse-marketing.repository';
import { DetectedFactRepository } from '../repositories/marketing/detected-fact.repository';
import { MarketingEntityRepository } from '../repositories/marketing/marketing-entity.repository';
import { ProcessAuditRepository } from '../repositories/process-audit/process-audit.repository';
import { DataImportsReaderRepository } from '../repositories/reader/data-imports-reader.repository';
import { FactsReaderRepository } from '../repositories/reader/facts-reader.repository';
import { RecommendationsReaderRepository } from '../repositories/reader/recommendations-reader.repository';
import { ReportsReaderRepository } from '../repositories/reader/reports-reader.repository';
import { ContextObjectRepository } from '../repositories/semantic/context-object.repository';
import { SemanticEntityRepository } from '../repositories/semantic/semantic-entity.repository';
import { SemanticRelationshipRepository } from '../repositories/semantic/semantic-relationship.repository';
import { ObjectStorageService } from '../storage/object-storage.service';

const repositories = [
  RecommendationRepository,
  AiReportRepository,
  AppsFlyerEventsRepository,
  AppsFlyerSnapshotsRepository,
  ClickHouseMarketingRepository,
  DetectedFactRepository,
  MarketingEntityRepository,
  RawImportFileRepository,
  DataImportRepository,
  ProjectRepository,
  ProcessAuditRepository,
  DataImportsReaderRepository,
  FactsReaderRepository,
  RecommendationsReaderRepository,
  ReportsReaderRepository,
  SemanticEntityRepository,
];

@Module({
  providers: [ObjectStorageService, ...repositories],
  exports: [ObjectStorageService, ...repositories],
})
export class MarketingInfrastructureModule {}
