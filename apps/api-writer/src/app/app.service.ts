import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { EventProducerService } from '@metrics-platform/core-infrastructure';
import { ProjectRepository } from '@metrics-platform/marketing-infrastructure';
import { FileHubService } from '@metrics-platform/marketing-application';
import { ObjectStorageService } from '@metrics-platform/marketing-infrastructure';
import { CreateEventCommand } from '@metrics-platform/core-application';
import { CreateEventDto } from '@metrics-platform/core-shared';
import type {
  CreateRawFilePayload,
  FileHubListFilters,
  UpdateRawFileTagsPayload,
} from '@metrics-platform/marketing-shared';
import type { CreateImportPayload, CreateProjectPayload, DataImportRecord, ProjectRecord } from './projects.types';

@Injectable()
export class AppService {
  private readonly imports = new Map<string, DataImportRecord[]>();

  constructor(
    private readonly commandBus: CommandBus,
    private readonly eventProducerService: EventProducerService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly projectRepository: ProjectRepository,
    private readonly fileHubService: FileHubService,
  ) {}

  async handleCreateEvent(dto: CreateEventDto) {
    return this.commandBus.execute(new CreateEventCommand(dto));
  }

  async createProject(payload: CreateProjectPayload): Promise<ProjectRecord> {
    return this.projectRepository.create({
      id: randomUUID(),
      name: payload.name,
      description: payload.description,
      defaultCurrency: payload.defaultCurrency ?? 'USD',
      timezone: payload.timezone ?? 'UTC',
    });
  }

  async listProjects(): Promise<ProjectRecord[]> {
    return this.projectRepository.list();
  }

  async createProjectImport(projectId: string, payload: CreateImportPayload): Promise<DataImportRecord> {
    const projectExists = await this.projectRepository.exists(projectId);
    if (!projectExists) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const importId = randomUUID();
    const bucketName = process.env.MARKETING_IMPORTS_BUCKET || 'marketing-imports';
    const objectKey = `${projectId}/${importId}/${payload.fileName}`;

    const contentBase64 = payload.contentBase64 || '';
    const storageResult = contentBase64
      ? await this.objectStorageService.putObject({ bucketName, objectKey, contentBase64 })
      : { uri: '', sizeBytes: 0 };

    const dataImport: DataImportRecord = {
      id: importId,
      projectId,
      fileName: payload.fileName,
      storageProvider: (process.env.MARKETING_STORAGE_PROVIDER as 'minio' | 's3') || 'minio',
      bucketName,
      objectKey,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      sizeBytes: storageResult.sizeBytes,
      storageUri: storageResult.uri,
    };

    const existing = this.imports.get(projectId) ?? [];
    existing.push(dataImport);
    this.imports.set(projectId, existing);

    await this.eventProducerService.publishMarketingImport({
      importId,
      projectId,
      fileName: payload.fileName,
      contentBase64,
      contentType: payload.contentType || 'text/csv',
      storageProvider: dataImport.storageProvider,
      bucketName,
      objectKey,
      createdAt: dataImport.createdAt,
      traceId: randomUUID(),
    });

    return dataImport;
  }

  async listProjectImports(projectId: string): Promise<DataImportRecord[]> {
    const projectExists = await this.projectRepository.exists(projectId);
    if (!projectExists) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return this.imports.get(projectId) ?? [];
  }

  uploadProjectFile(projectId: string, payload: CreateRawFilePayload) {
    return this.fileHubService.uploadFile(projectId, payload);
  }

  listProjectFiles(projectId: string, filters: FileHubListFilters) {
    return this.fileHubService.listFiles(projectId, filters);
  }

  getProjectFile(projectId: string, fileId: string) {
    return this.fileHubService.getFile(projectId, fileId);
  }

  deleteProjectFile(projectId: string, fileId: string) {
    return this.fileHubService.deleteFile(projectId, fileId);
  }

  updateProjectFileTags(projectId: string, fileId: string, payload: UpdateRawFileTagsPayload) {
    return this.fileHubService.updateTags(projectId, fileId, payload);
  }

  processProjectFile(projectId: string, fileId: string) {
    return this.fileHubService.requestProcessing(projectId, fileId, 'api-writer');
  }

  reprocessProjectFile(projectId: string, fileId: string) {
    return this.fileHubService.reprocessFile(projectId, fileId, 'api-writer');
  }
}
