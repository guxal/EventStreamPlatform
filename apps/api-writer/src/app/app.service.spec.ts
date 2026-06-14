import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { EventProducerService } from '@metrics-platform/core-infrastructure';
import { FileHubService, ProjectSourceMappingService, SchemaDetectionService, AiSchemaAssistantService } from '@metrics-platform/marketing-application';
import { ObjectStorageService, ProjectRepository, AnalysisRunRepository, DataImportRepository, ProjectAnalysisRunRepository, RawImportFileRepository } from '@metrics-platform/marketing-infrastructure';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: CommandBus,
          useValue: {
            execute: jest.fn().mockResolvedValue({ id: '123', eventType: 'TestType' }),
          },
        },
        {
          provide: EventProducerService,
          useValue: { publishMarketingImport: jest.fn(), publishMarketingAnalysis: jest.fn(), publishProjectGoldRecompute: jest.fn().mockResolvedValue({ id: 'job_1' }) },
        },
        {
          provide: ObjectStorageService,
          useValue: { putObject: jest.fn() },
        },
        {
          provide: ProjectRepository,
          useValue: { create: jest.fn(), list: jest.fn(), exists: jest.fn() },
        },
        { provide: AnalysisRunRepository, useValue: { create: jest.fn() } },
        { provide: ProjectAnalysisRunRepository, useValue: { create: jest.fn().mockImplementation(async (input) => input) } },
        { provide: DataImportRepository, useValue: { findByProjectAndId: jest.fn() } },
        { provide: RawImportFileRepository, useValue: { findByProjectAndId: jest.fn() } },
        { provide: ProjectSourceMappingService, useValue: { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), confirm: jest.fn(), applyToFile: jest.fn() } },
        { provide: SchemaDetectionService, useValue: { analyze: jest.fn() } },
        { provide: AiSchemaAssistantService, useValue: { suggest: jest.fn() } },
        {
          provide: FileHubService,
          useValue: {
            uploadFile: jest.fn(),
            listFiles: jest.fn(),
            getFile: jest.fn(),
            deleteFile: jest.fn(),
            updateTags: jest.fn(),
            requestProcessing: jest.fn(),
            reprocessFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should handle create event', async () => {
    const dto = { eventType: 'TestType', userId: 'test-user' };
    const result = await service.handleCreateEvent(dto);
    expect(result).toBeDefined();
  });

  it('should enqueue project gold recompute', async () => {
    const projectRepository = module.get<ProjectRepository>(ProjectRepository);
    const producer = module.get<EventProducerService>(EventProducerService);
    (projectRepository.exists as jest.Mock).mockResolvedValue(true);

    const result = await service.recomputeProjectGold('project-id', { source: 'appsflyer', dateRangeStart: '2026-05-14', dateRangeEnd: '2026-05-21', force: true });

    expect(result.job).toMatchObject({ queue: 'project-analysis', name: 'recompute-project-gold' });
    expect(producer.publishProjectGoldRecompute).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-id', source: 'appsflyer', triggeredBy: 'manual', force: true }));
  });
});
