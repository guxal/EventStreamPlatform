import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule, CommandBus } from '@nestjs/cqrs';
import { EventProducerService } from '@metrics-platform/core-infrastructure';
import { FileHubService } from '@metrics-platform/marketing-application';
import { ObjectStorageService, ProjectRepository, AnalysisRunRepository, DataImportRepository, ProjectAnalysisRunRepository, RawImportFileRepository } from '@metrics-platform/marketing-infrastructure';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [CqrsModule],
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: CommandBus,
          useValue: {
            execute: jest.fn().mockResolvedValue({ id: '123', eventType: 'TestType', userId: 'test-user' }),
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
  });

  it('should be defined', () => {
    const controller = app.get<AppController>(AppController);
    expect(controller).toBeDefined();
  });

  it('should create an event', async () => {
    const controller = app.get<AppController>(AppController);
    const dto = { eventType: 'TestType', userId: 'test-user' };
    const result = await controller.createEvent(dto);
    expect(result).toBeDefined();
  });
});
