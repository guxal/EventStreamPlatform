import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getData: jest.fn().mockReturnValue({ message: 'EventStream Platform Admin API' }),
            listProjectProcesses: jest.fn(),
            getProjectProcess: jest.fn(),
          },
        },
      ],
    }).compile();
  });

  describe('getData', () => {
    it('should return admin API message', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController.getData()).toEqual({ message: 'EventStream Platform Admin API' });
    });
  });
});
