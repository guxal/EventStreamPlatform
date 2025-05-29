import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
  });

  it('should be defined', () => {
    const controller = app.get<AppController>(AppController);
    expect(controller).toBeDefined();
  });

  it('should create an event', async () => {
    const controller = app.get<AppController>(AppController);
    const dto = { name: 'Test Event', data: { key: 'value' }, eventType: 'TestType' };
    const result = await controller.createEvent(dto);
    expect(result).toBeDefined();
    // Aquí puedes agregar más expectativas según la lógica de tu servicio
  });

  afterAll(async () => {
    await app.close();
  });
});
