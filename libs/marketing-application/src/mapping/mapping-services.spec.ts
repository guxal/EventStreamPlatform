import { DataSource, MappingProfileStatus, RawFileStatus, ReportType } from '@metrics-platform/marketing-shared';
import { AiSchemaAssistantService } from './ai-schema-assistant.service';
import { BuiltInSourceMappingRegistry } from './built-in-source-mapping.registry';
import { MappingValidationService } from './mapping-validation.service';
import { SchemaDetectionService } from './schema-detection.service';

const rawRepo = (state: any = {}) => ({
  findByProjectAndId: jest.fn(async () => state.rawFile ?? null),
  updateMapping: jest.fn(async (_p, _f, input) => ({ ...input, id: 'file-1' })),
});

const createService = (mappings: any, rawFiles: any = rawRepo()) => new SchemaDetectionService(
  mappings,
  rawFiles,
  new AiSchemaAssistantService(),
  new BuiltInSourceMappingRegistry(),
  new MappingValidationService(),
);

const appsFlyerInstallHeaders = ['AppsFlyer ID', 'Install Time', 'Media Source', 'Campaign'];
const appsFlyerEventHeaders = ['Event Name', 'Event Time', 'AppsFlyer ID', 'Customer User ID', 'Media Source', 'Campaign', 'Event Value'];
const blockedEventHeaders = ['Event Name', 'Event Time', 'AppsFlyer ID', 'Blocked Reason', 'Rejected Reason', 'Media Source'];

describe('Client mapping profile services', () => {
  it('creates deterministic schema signatures from headers and detects schema changes', () => {
    const service = createService({});
    const signature = service.schemaSignature(DataSource.APPSFLYER, ReportType.INSTALLS, ['Campaign', 'AppsFlyer ID']);
    expect(signature).toBe(service.schemaSignature(DataSource.APPSFLYER, ReportType.INSTALLS, ['appsflyer_id', 'campaign']))
    expect(signature).not.toBe(service.schemaSignature(DataSource.APPSFLYER, ReportType.INSTALLS, ['AppsFlyer ID', 'Install Time']));
  });

  it('reuses an existing active project mapping for the same schema', async () => {
    const mapping = { id: 'mapping-1', projectId: 'p', source: DataSource.APPSFLYER, reportType: ReportType.INSTALLS, status: MappingProfileStatus.ACTIVE, columnMapping: { 'Install Time': 'install_time', 'AppsFlyer ID': 'appsflyer_id' }, eventMapping: {}, identityStrategy: ['appsflyer_id'], sensitiveFields: ['AppsFlyer ID'], currency: 'USD', timezone: 'UTC', schemaSignature: 'ignored' };
    const mappings = { findByProjectAndId: jest.fn(), findActiveBySchema: jest.fn().mockResolvedValue(mapping) };
    const raws = rawRepo();
    const service = createService(mappings, raws);
    const result = await service.analyze({ projectId: 'p', rawFileId: 'file-1', source: DataSource.APPSFLYER, reportType: ReportType.INSTALLS, headers: appsFlyerInstallHeaders, sampleRows: [], classificationConfidence: 1 });
    expect(result.resolutionType).toBe('PROJECT_MAPPING');
    expect(result.mapping).toBe(mapping);
    expect(raws.updateMapping).toHaveBeenCalledWith('p', 'file-1', expect.objectContaining({ mappingId: 'mapping-1', mappingStatus: RawFileStatus.MAPPING_CONFIRMED, status: RawFileStatus.READY_TO_PROCESS }));
  });

  it('auto-creates a system mapping from built-in AppsFlyer installs defaults', async () => {
    const mappings = { findByProjectAndId: jest.fn(), findActiveBySchema: jest.fn().mockResolvedValue(null), createOrReuseBuiltInDefault: jest.fn(async (input) => ({ ...input, id: 'system-1', createdAt: 'now', updatedAt: 'now' })) };
    const result = await createService(mappings).analyze({ projectId: 'p', rawFileId: 'file-1', source: DataSource.APPSFLYER, reportType: ReportType.INSTALLS, headers: appsFlyerInstallHeaders, sampleRows: [], classificationConfidence: 0.96 });
    expect(result.resolutionType).toBe('BUILT_IN_DEFAULT');
    expect(result.rawFile.status).toBe(RawFileStatus.READY_TO_PROCESS);
    expect(mappings.createOrReuseBuiltInDefault).toHaveBeenCalledWith(expect.objectContaining({ schemaSignature: result.schemaSignature, metadata: expect.objectContaining({ createdFrom: 'BUILT_IN_DEFAULT_MAPPING' }) }));
  });

  it('auto-creates a system mapping from built-in AppsFlyer in_app_events defaults without AI', async () => {
    const mappings = { findByProjectAndId: jest.fn(), findActiveBySchema: jest.fn().mockResolvedValue(null), createOrReuseBuiltInDefault: jest.fn(async (input) => ({ ...input, id: 'system-2', createdAt: 'now', updatedAt: 'now' })) };
    const ai = new AiSchemaAssistantService();
    jest.spyOn(ai, 'suggest');
    const service = new SchemaDetectionService(mappings as any, rawRepo() as any, ai, new BuiltInSourceMappingRegistry(), new MappingValidationService());
    const result = await service.analyze({ projectId: 'p', rawFileId: 'file-1', source: DataSource.APPSFLYER, reportType: ReportType.IN_APP_EVENTS, headers: appsFlyerEventHeaders, sampleRows: [], classificationConfidence: 0.96, useAi: true });
    expect(result.resolutionType).toBe('BUILT_IN_DEFAULT');
    expect(ai.suggest).not.toHaveBeenCalled();
  });

  it('auto-creates a system mapping from built-in AppsFlyer blocked_in_app_events defaults', async () => {
    const mappings = { findByProjectAndId: jest.fn(), findActiveBySchema: jest.fn().mockResolvedValue(null), createOrReuseBuiltInDefault: jest.fn(async (input) => ({ ...input, id: 'system-3', createdAt: 'now', updatedAt: 'now' })) };
    const result = await createService(mappings).analyze({ projectId: 'p', rawFileId: 'file-1', source: DataSource.APPSFLYER, reportType: ReportType.BLOCKED_IN_APP_EVENTS, headers: blockedEventHeaders, sampleRows: [], classificationConfidence: 0.96 });
    expect(result.resolutionType).toBe('BUILT_IN_DEFAULT');
    expect(result.rawFile.status).toBe(RawFileStatus.READY_TO_PROCESS);
  });

  it('leaves ambiguous/new schemas as MAPPING_REQUIRED when default validation fails', async () => {
    const mappings = { findByProjectAndId: jest.fn(), findActiveBySchema: jest.fn().mockResolvedValue(null), createOrReuseBuiltInDefault: jest.fn() };
    const result = await createService(mappings).analyze({ projectId: 'p', rawFileId: 'file-1', source: DataSource.APPSFLYER, reportType: ReportType.IN_APP_EVENTS, headers: ['Event Time', 'Campaign'], sampleRows: [], classificationConfidence: 0.96 });
    expect(result.resolutionType).toBe('MANUAL_REQUIRED');
    expect(result.rawFile.status).toBe(RawFileStatus.MAPPING_REQUIRED);
    expect(mappings.createOrReuseBuiltInDefault).not.toHaveBeenCalled();
  });

  it('does not auto-apply defaults when critical columns are missing', async () => {
    const mappings = { findByProjectAndId: jest.fn(), findActiveBySchema: jest.fn().mockResolvedValue(null), createOrReuseBuiltInDefault: jest.fn() };
    const result = await createService(mappings).analyze({ projectId: 'p', rawFileId: 'file-1', source: DataSource.APPSFLYER, reportType: ReportType.INSTALLS, headers: ['Campaign'], sampleRows: [], classificationConfidence: 0.96 });
    expect(result.requiresReview).toBe(true);
    expect(result.nextAction).toBe('RUN_AI_SCHEMA_ASSISTANT');
  });

  it('sanitizes sensitive sample rows and returns a mapping suggestion for unknown schemas', async () => {
    const ai = new AiSchemaAssistantService();
    const result = await ai.suggest({ projectId: 'p', rawFileId: 'f', source: DataSource.APPSFLYER, reportType: ReportType.INSTALLS, headers: ['IP', 'Advertising ID', 'AppsFlyer ID', 'Customer User ID', 'Original URL', 'User Agent', 'Campaign'], sampleRows: [{ IP: '1.2.3.4', 'Advertising ID': 'adid', 'AppsFlyer ID': 'afid', 'Customer User ID': 'cust', 'Original URL': 'https://example.com/?token=x', 'User Agent': 'ua', Campaign: 'safe-campaign' }] });
    expect(result.columnMapping.Campaign).toBe('campaign_name');
    expect(JSON.stringify(result.sanitizedSampleRows)).not.toContain('1.2.3.4');
    expect(JSON.stringify(result.sanitizedSampleRows)).not.toContain('afid');
    expect(JSON.stringify(result.sanitizedSampleRows)).not.toContain('cust');
  });

  it('validates AppsFlyer installs and event mappings and rejects missing event_name', () => {
    const validator = new MappingValidationService();
    expect(validator.validate({ source: DataSource.APPSFLYER, reportType: ReportType.INSTALLS, status: MappingProfileStatus.ACTIVE, columnMapping: { 'Install Time': 'install_time', 'AppsFlyer ID': 'appsflyer_id' }, eventMapping: {}, identityStrategy: ['appsflyer_id'], sensitiveFields: ['AppsFlyer ID'], currency: 'CAD', timezone: 'America/Toronto' }).valid).toBe(true);
    expect(validator.validate({ source: DataSource.APPSFLYER, reportType: ReportType.IN_APP_EVENTS, status: MappingProfileStatus.ACTIVE, columnMapping: { 'Event Time': 'event_time', 'AppsFlyer ID': 'appsflyer_id' }, eventMapping: { deposit_success: 'DEPOSIT' }, identityStrategy: ['appsflyer_id'], sensitiveFields: ['AppsFlyer ID'], currency: 'CAD', timezone: 'America/Toronto' }).valid).toBe(false);
  });
});
