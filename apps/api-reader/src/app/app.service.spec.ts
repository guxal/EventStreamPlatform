import { Test } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';
import {
  AiReportRepository,
  AppsFlyerEventsRepository,
  DataImportsReaderRepository,
  DetectedFactRepository,
  ProcessAuditRepository,
  RecommendationRepository,
  SemanticEntityRepository,
  SemanticRelationshipRepository,
  ContextObjectRepository,
} from '@metrics-platform/marketing-infrastructure';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: QueryBus, useValue: { execute: jest.fn() } },
        { provide: DetectedFactRepository, useValue: { listByProject: jest.fn().mockResolvedValue([]) } },
        { provide: RecommendationRepository, useValue: { listByProject: jest.fn().mockResolvedValue([]) } },
        { provide: AiReportRepository, useValue: { listByProject: jest.fn().mockResolvedValue([]) } },
        { provide: ProcessAuditRepository, useValue: { listRunsByProject: jest.fn().mockResolvedValue([]), getRunWithSteps: jest.fn(), getLatestRunByImport: jest.fn() } },
        { provide: AppsFlyerEventsRepository, useValue: { getOverview: jest.fn().mockResolvedValue({ totalEvents: 0, registrations: 0, deposits: 0, firstDeposits: 0, depositAmount: 0, unavailableMetrics: [] }) } },
        { provide: DataImportsReaderRepository, useValue: { getAppsFlyerImportSummary: jest.fn() } },
        { provide: SemanticEntityRepository, useValue: { searchEntities: jest.fn().mockResolvedValue([]) } },
        { provide: SemanticRelationshipRepository, useValue: { searchRelationships: jest.fn().mockResolvedValue([]) } },
        { provide: ContextObjectRepository, useValue: { searchContextObjects: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('getProjectDashboard', () => {
    it('should return project dashboard summary', async () => {
      await expect(service.getProjectDashboard('project_1')).resolves.toMatchObject({ projectId: 'project_1' });
    });
  });
});
