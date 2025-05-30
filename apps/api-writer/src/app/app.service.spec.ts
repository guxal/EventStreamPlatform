import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { CommandBus } from '@nestjs/cqrs';

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
    // Puedes agregar más asserts aquí según el mock
  });
});
