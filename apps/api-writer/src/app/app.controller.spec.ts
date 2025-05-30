import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CqrsModule, CommandBus } from '@nestjs/cqrs';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [CqrsModule], // <- esto es clave!
      controllers: [AppController],
      providers: [
        AppService,
        // Puedes mockear CommandBus si quieres aislar lógica
        {
          provide: CommandBus,
          useValue: {
            execute: jest.fn().mockResolvedValue({ id: '123', eventType: 'TestType', userId: 'test-user' }),
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
    // Puedes esperar { id: '123', eventType: 'TestType', ... } según el mock de arriba
  });
});
