import { Test } from '@nestjs/testing';
import { ProcessAuditRepository } from '@metrics-platform/marketing-infrastructure';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: ProcessAuditRepository, useValue: { listRunsByProject: jest.fn().mockResolvedValue([]), getRunWithSteps: jest.fn() } },
      ],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('getData', () => {
    it('should return admin API message', () => {
      expect(service.getData()).toEqual({ message: 'EventStream Platform Admin API' });
    });
  });
});
