import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, MappingProfileStatus, RawFileStatus, ReportType, type ProjectSourceMapping } from '@metrics-platform/marketing-shared';
import { ProjectRepository, ProjectSourceMappingRepository, RawImportFileRepository } from '@metrics-platform/marketing-infrastructure';
import { MappingValidationService } from './mapping-validation.service';

@Injectable()
export class ProjectSourceMappingService {
  constructor(private readonly projects: ProjectRepository, private readonly mappings: ProjectSourceMappingRepository, private readonly rawFiles: RawImportFileRepository, private readonly validator: MappingValidationService) {}
  async list(projectId: string, filters: { source?: string; reportType?: string; status?: string } = {}) { await this.assertProject(projectId); return this.mappings.list(projectId, { ...filters, source: filters.source ? this.normalizeSource(filters.source) : undefined, reportType: filters.reportType ? this.normalizeReportType(filters.reportType) : undefined }); }
  async get(projectId: string, mappingId: string) { await this.assertProject(projectId); const m = await this.mappings.findByProjectAndId(projectId, mappingId); if (!m) throw new NotFoundException(`Mapping ${mappingId} not found`); return m; }
  async create(projectId: string, payload: Partial<ProjectSourceMapping>) { await this.assertProject(projectId); return this.mappings.create({ ...payload, projectId, source: payload.source ? this.normalizeSource(String(payload.source)) : payload.source, reportType: payload.reportType ? this.normalizeReportType(String(payload.reportType)) : payload.reportType, status: payload.status ?? MappingProfileStatus.DRAFT }); }
  async update(projectId: string, mappingId: string, payload: Partial<ProjectSourceMapping>) { await this.get(projectId, mappingId); return this.mappings.update(projectId, mappingId, { ...payload, source: payload.source ? this.normalizeSource(String(payload.source)) : payload.source, reportType: payload.reportType ? this.normalizeReportType(String(payload.reportType)) : payload.reportType }); }
  async confirm(projectId: string, mappingId: string, confirmedBy = 'api-writer') {
    const mapping = await this.get(projectId, mappingId);
    const candidate = { ...mapping, status: MappingProfileStatus.CONFIRMED };
    const validation = this.validator.validate(candidate);
    if (!validation.valid) throw new BadRequestException({ message: 'Mapping validation failed', validation });
    return { mapping: await this.mappings.confirm(projectId, mappingId, confirmedBy, true), validation };
  }
  async applyToFile(projectId: string, fileId: string, mappingId: string) {
    const rawFile = await this.rawFiles.findByProjectAndId(projectId, fileId); if (!rawFile) throw new NotFoundException(`Raw file ${fileId} not found`);
    const mapping = await this.get(projectId, mappingId);
    if (String(mapping.source) !== String(rawFile.source) || String(mapping.reportType) !== String(rawFile.reportType)) throw new BadRequestException('Mapping source/reportType must match raw file classification');
    const validation = this.validator.validate(mapping);
    if (!validation.valid) return { rawFile: await this.rawFiles.updateMapping(projectId, fileId, { mappingId, schemaSignature: mapping.schemaSignature ?? rawFile.schemaSignature ?? null, mappingStatus: MappingProfileStatus.NEEDS_REVIEW, mappingValidation: validation, status: RawFileStatus.MAPPING_REQUIRED, needsReview: true }), validation };
    return { rawFile: await this.rawFiles.updateMapping(projectId, fileId, { mappingId, schemaSignature: mapping.schemaSignature ?? rawFile.schemaSignature ?? null, mappingStatus: RawFileStatus.MAPPING_CONFIRMED, mappingValidation: { ...validation, resolutionType: 'PROJECT_MAPPING', requiresReview: false, nextAction: 'READY_TO_PROCESS' }, status: RawFileStatus.READY_TO_PROCESS, needsReview: false }), validation };
  }
  private normalizeSource(source: string): DataSource {
    const normalized = String(source).trim().toUpperCase();
    if (normalized === 'APPSFLYER') return DataSource.APPSFLYER;
    if (['GOOGLE_ADS', 'GOOGLE-ADS', 'GOOGLE ADS'].includes(normalized)) return DataSource.GOOGLE_ADS;
    if (['META_ADS', 'META-ADS', 'META ADS'].includes(normalized)) return DataSource.META_ADS;
    return DataSource.UNKNOWN;
  }

  private normalizeReportType(reportType: string): ReportType {
    const normalized = String(reportType).trim().toLowerCase().replace(/[-\s]+/g, '_');
    return (Object.values(ReportType) as string[]).includes(normalized) ? normalized as ReportType : ReportType.UNKNOWN;
  }

  private async assertProject(projectId: string) { if (!(await this.projects.exists(projectId))) throw new NotFoundException(`Project ${projectId} not found`); }
}
