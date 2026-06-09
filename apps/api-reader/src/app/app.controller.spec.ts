import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;
  const appService = {
    getProjectDashboard: jest.fn().mockResolvedValue({ projectId: 'project_1', period: 'last_7_days', totals: {} }),
    handleGetMetric: jest.fn(),
    handleListMetrics: jest.fn(),
    listProjectCampaigns: jest.fn(),
    listProjectKeywords: jest.fn(),
    listProjectFacts: jest.fn(),
    listProjectRecommendations: jest.fn(),
    listProjectReports: jest.fn(),
    listProjectProcesses: jest.fn(),
    getProjectProcess: jest.fn(),
    getImportFlow: jest.fn(),
    getOverview: jest.fn(),
    getSourceMetrics: jest.fn(),
    getEntitiesPerformance: jest.fn(),
    getAppsFlyerOverview: jest.fn(),
    getAppsFlyerImportSummary: jest.fn(),
    getAppsFlyerEventsByName: jest.fn(),
    getAppsFlyerMediaSources: jest.fn(),
    getAppsFlyerCampaigns: jest.fn(),
    getAppsFlyerBlockedTraffic: jest.fn(),
    listContextObjects: jest.fn(),
    listSemanticRelationships: jest.fn(),
    listSemanticEntities: jest.fn(),
    askAiChat: jest.fn(),
  };

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();
  });

  describe('getDashboard', () => {
    it('should delegate dashboard lookup', async () => {
      const appController = app.get<AppController>(AppController);
      await expect(appController.getDashboard('project_1')).resolves.toEqual({ projectId: 'project_1', period: 'last_7_days', totals: {} });
    });
  });
});
