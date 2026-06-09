import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { EventProducerService } from '@metrics-platform/core-infrastructure';
import { FileHubService } from '@metrics-platform/marketing-application';
import { ObjectStorageService, ProjectRepository } from '@metrics-platform/marketing-infrastructure';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
          useValue: { publishMarketingImport: jest.fn() },
        },
        {
          provide: ObjectStorageService,
          useValue: { putObject: jest.fn() },
        },
        {
          provide: ProjectRepository,
          useValue: { create: jest.fn(), list: jest.fn(), exists: jest.fn() },
        },
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
});
