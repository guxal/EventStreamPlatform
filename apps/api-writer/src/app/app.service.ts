import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { EventProducerService } from '@metrics-platform/core-infrastructure';
import { ObjectStorageService } from '@metrics-platform/marketing-infrastructure';
import { CreateEventCommand } from '@metrics-platform/core-application';
import { CreateEventDto } from '@metrics-platform/core-shared';
import type { CreateImportPayload, CreateProjectPayload, DataImportRecord, ProjectRecord } from './projects.types';

@Injectable()
export class AppService {
  private readonly projects = new Map<string, ProjectRecord>();
  private readonly imports = new Map<string, DataImportRecord[]>();

  constructor(
    private readonly commandBus: CommandBus,
    private readonly eventProducerService: EventProducerService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async handleCreateEvent(dto: CreateEventDto) {
    return this.commandBus.execute(new CreateEventCommand(dto));
  }

  createProject(payload: CreateProjectPayload): ProjectRecord {
    const project: ProjectRecord = {
      id: randomUUID(),
      name: payload.name,
      description: payload.description,
      defaultCurrency: payload.defaultCurrency ?? 'USD',
      timezone: payload.timezone ?? 'UTC',
      createdAt: new Date().toISOString(),
    };

    this.projects.set(project.id, project);
    return project;
  }

  listProjects(): ProjectRecord[] {
    return Array.from(this.projects.values());
  }

  async createProjectImport(projectId: string, payload: CreateImportPayload): Promise<DataImportRecord> {
    const project = this.projects.get(projectId);
    if (!project) {
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

  listProjectImports(projectId: string): DataImportRecord[] {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return this.imports.get(projectId) ?? [];
  }
}
