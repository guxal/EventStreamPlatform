import { BadRequestException } from '@nestjs/common';
import { DataSource, RawFileStatus, ReportType, type FileProfile, type RawImportFileRecord } from '@metrics-platform/marketing-shared';
import { FileHubService } from './file-hub.service';

const baseRawFile = (overrides: Partial<RawImportFileRecord> = {}): RawImportFileRecord => ({
  id: 'file-1',
  projectId: 'project-1',
  dataImportId: null,
  originalFileName: 'campaigns.csv',
  storageUri: 'file:///tmp/campaigns.csv',
  bucket: 'marketing-imports',
  objectKey: 'project-1/raw-files/file-1/campaigns.csv',
  sizeBytes: 100,
  checksum: null,
  mimeType: 'text/csv',
  rowCount: null,
  headers: [],
  sampleRows: [],
  source: DataSource.UNKNOWN,
  reportType: ReportType.UNKNOWN,
  tags: {},
  classificationConfidence: 0,
  needsReview: true,
  status: RawFileStatus.UPLOADED,
  errorMessage: null,
  errorSummary: null,
  createdAt: '2026-06-08T00:00:00.000Z',
  updatedAt: '2026-06-08T00:00:00.000Z',
  ...overrides,
});

const profile: FileProfile = {
  headers: ['Campaign', 'Campaign ID', 'Impressions', 'Clicks', 'Cost', 'Conversions'],
  rowCount: 1,
  sampleRows: [{ Campaign: 'Brand' }],
  sizeBytes: 100,
  checksum: 'abc123',
  isEmpty: false,
  warnings: [],
};

describe('FileHubService', () => {
  const createService = (rawFileOverrides: Partial<RawImportFileRecord> = {}) => {
    const state = { rawFile: baseRawFile(rawFileOverrides) };
    const rawRepo = {
      create: jest.fn(async () => state.rawFile),
      updateStatus: jest.fn(async (_projectId, _fileId, status) => {
        state.rawFile = { ...state.rawFile, status };
        return state.rawFile;
      }),
      updateProfile: jest.fn(async (_projectId, _fileId, input) => {
        state.rawFile = {
          ...state.rawFile,
          checksum: input.checksum,
          rowCount: input.rowCount,
          headers: input.headers,
          sampleRows: input.sampleRows,
          status: input.status,
        };
        return state.rawFile;
      }),
      updateClassification: jest.fn(async (_projectId, _fileId, input) => {
        state.rawFile = {
          ...state.rawFile,
          source: input.source,
          reportType: input.reportType,
          classificationConfidence: input.classificationConfidence,
          needsReview: input.needsReview,
          status: input.status,
          tags: input.tags ?? state.rawFile.tags,
        };
        return state.rawFile;
      }),
      findByProjectAndId: jest.fn(async () => state.rawFile),
      attachDataImport: jest.fn(async (_projectId, _fileId, dataImportId) => {
        state.rawFile = { ...state.rawFile, dataImportId, status: RawFileStatus.PROCESSING };
        return state.rawFile;
      }),
      listByProject: jest.fn(async () => [state.rawFile]),
    };
    const service = new FileHubService(
      { putObject: jest.fn(async () => ({ uri: 'file:///tmp/campaigns.csv', sizeBytes: 100 })) } as never,
      rawRepo as never,
      { createForRawFile: jest.fn(async ({ id, projectId }) => ({ id, projectId, status: 'PROCESSING', createdAt: 'now' })) } as never,
      { exists: jest.fn(async () => true) } as never,
      { profileStoredCsv: jest.fn(async () => profile) } as never,
      { classify: jest.fn(() => ({ source: DataSource.GOOGLE_ADS, reportType: ReportType.CAMPAIGNS, confidence: 0.92, reasons: [] })) } as never,
      { publishMarketingImport: jest.fn(async () => undefined) } as never,
    );
    return { service, rawRepo };
  };

  it('marks high-confidence uploads as READY_TO_PROCESS', async () => {
    const { service } = createService();
    const result = await service.uploadFile('project-1', {
      fileName: 'campaigns.csv',
      contentBase64: Buffer.from('Campaign,Clicks\nBrand,1\n').toString('base64'),
    });

    expect(result.status).toBe(RawFileStatus.READY_TO_PROCESS);
    expect(result.rawFile.needsReview).toBe(false);
  });

  it('manual valid tags set files to READY_TO_PROCESS', async () => {
    const { service } = createService({ status: RawFileStatus.NEEDS_REVIEW });
    const result = await service.updateTags('project-1', 'file-1', {
      source: 'appsflyer' as DataSource,
      report_type: 'installs' as ReportType,
      tags: { account: 'demo' },
    });

    expect(result.status).toBe(RawFileStatus.READY_TO_PROCESS);
    expect(result.needsReview).toBe(false);
  });

  it('rejects processing unless status is READY_TO_PROCESS', async () => {
    const { service } = createService({ status: RawFileStatus.NEEDS_REVIEW });

    await expect(service.requestProcessing('project-1', 'file-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets READY_TO_PROCESS files to PROCESSING and publishes a File Hub job payload', async () => {
    const { service } = createService({
      status: RawFileStatus.READY_TO_PROCESS,
      source: DataSource.GOOGLE_ADS,
      reportType: ReportType.CAMPAIGNS,
      needsReview: false,
    });

    const result = await service.requestProcessing('project-1', 'file-1');

    expect(result.rawFile.status).toBe(RawFileStatus.PROCESSING);
    expect(result.payload.rawFileId).toBe('file-1');
    expect(result.payload.source).toBe(DataSource.GOOGLE_ADS);
    expect(result.payload.reportType).toBe(ReportType.CAMPAIGNS);
  });
});
