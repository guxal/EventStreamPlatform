import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource as TypeOrmDataSource } from 'typeorm';
import { MappingProfileStatus, type ProjectSourceMapping } from '@metrics-platform/marketing-shared';
import { firstQueryRow, unwrapQueryRows } from '../../database/typeorm-query.util';

@Injectable()
export class ProjectSourceMappingRepository {
  constructor(@InjectDataSource() private readonly dataSource: TypeOrmDataSource) {}
  async list(projectId: string, filters: { source?: string; reportType?: string; status?: string } = {}) {
    const clauses = ['project_id = $1']; const params: unknown[] = [projectId];
    if (filters.source) { params.push(filters.source); clauses.push(`source = $${params.length}`); }
    if (filters.reportType) { params.push(filters.reportType); clauses.push(`report_type = $${params.length}`); }
    if (filters.status) { params.push(filters.status); clauses.push(`status = $${params.length}`); }
    const rows = await this.dataSource.query(`SELECT * FROM project_source_mappings WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC`, params);
    return unwrapQueryRows<Record<string, unknown>>(rows).map((r) => this.toRecord(r));
  }
  async findByProjectAndId(projectId: string, id: string) { const rows = await this.dataSource.query('SELECT * FROM project_source_mappings WHERE project_id=$1 AND id=$2 LIMIT 1',[projectId,id]); const row=unwrapQueryRows<Record<string,unknown>>(rows)[0]; return row?this.toRecord(row):null; }
  async findActiveBySchema(projectId: string, source: string, reportType: string, schemaSignature: string) { const rows=await this.dataSource.query(`SELECT * FROM project_source_mappings WHERE project_id=$1 AND source=$2 AND report_type=$3 AND schema_signature=$4 AND is_active=true AND status IN ('ACTIVE','CONFIRMED') LIMIT 1`,[projectId,source,reportType,schemaSignature]); const row=unwrapQueryRows<Record<string,unknown>>(rows)[0]; return row?this.toRecord(row):null; }
  async createOrReuseSuggestion(input: Partial<ProjectSourceMapping> & { projectId: string; source: string; reportType: string; schemaSignature: string; headerSignature?: string | null }) { const existing=await this.dataSource.query(`SELECT * FROM project_source_mappings WHERE project_id=$1 AND source=$2 AND report_type=$3 AND schema_signature=$4 AND status IN ('DRAFT','AI_SUGGESTED','NEEDS_REVIEW') LIMIT 1`,[input.projectId,input.source,input.reportType,input.schemaSignature]); const row=unwrapQueryRows<Record<string,unknown>>(existing)[0]; if(row) return this.update(input.projectId, String(row.id), input); return this.create(input); }
  async createOrReuseBuiltInDefault(input: Partial<ProjectSourceMapping> & { projectId: string; source: string; reportType: string; schemaSignature: string; headerSignature?: string | null }) {
    const existing = await this.findActiveBySchema(input.projectId, input.source, input.reportType, input.schemaSignature);
    if (existing) return existing;
    return this.create({
      ...input,
      id: undefined,
      status: MappingProfileStatus.ACTIVE,
      isActive: true,
      aiSuggested: false,
      userConfirmed: false,
      metadata: {
        ...(input.metadata ?? {}),
        createdFrom: 'BUILT_IN_DEFAULT_MAPPING',
      },
    });
  }
  async create(input: Partial<ProjectSourceMapping> & { projectId: string }) {
    const versionRows = await this.dataSource.query('SELECT COALESCE(MAX(version),0)+1 AS version FROM project_source_mappings WHERE project_id=$1 AND source=$2 AND report_type=$3 AND schema_signature IS NOT DISTINCT FROM $4',[input.projectId,input.source,input.reportType,input.schemaSignature ?? null]);
    const version = Number(unwrapQueryRows<any>(versionRows)[0]?.version ?? 1);
    const rows = await this.dataSource.query(`INSERT INTO project_source_mappings (id,project_id,source,report_type,version,status,is_active,column_mapping,event_mapping,identity_strategy,currency,timezone,kpi_rules,sensitive_fields,data_quality_rules,schema_signature,header_signature,sample_fingerprint,ai_suggested,ai_confidence,user_confirmed,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17,$18,$19,$20,$21,$22::jsonb) RETURNING *`,[input.id ?? randomUUID(),input.projectId,input.source,input.reportType, input.version ?? version,input.status ?? MappingProfileStatus.DRAFT, input.isActive ?? false, JSON.stringify(input.columnMapping ?? {}), JSON.stringify(input.eventMapping ?? {}), JSON.stringify(input.identityStrategy ?? []), input.currency ?? null, input.timezone ?? null, JSON.stringify(input.kpiRules ?? {}), JSON.stringify(input.sensitiveFields ?? []), JSON.stringify(input.dataQualityRules ?? {}), input.schemaSignature ?? null, input.headerSignature ?? null, input.sampleFingerprint ?? null, input.aiSuggested ?? input.status === MappingProfileStatus.AI_SUGGESTED, input.aiConfidence ?? null, input.userConfirmed ?? false, JSON.stringify(input.metadata ?? {})]);
    return this.toRecord(firstQueryRow(rows));
  }
  async update(projectId: string, id: string, input: Partial<ProjectSourceMapping>) { const current=await this.findByProjectAndId(projectId,id); if(!current) throw new Error(`Mapping ${id} not found`); const merged={...current,...input}; const rows=await this.dataSource.query(`UPDATE project_source_mappings SET source=$3,report_type=$4,status=$5,is_active=$6,column_mapping=$7::jsonb,event_mapping=$8::jsonb,identity_strategy=$9::jsonb,currency=$10,timezone=$11,kpi_rules=$12::jsonb,sensitive_fields=$13::jsonb,data_quality_rules=$14::jsonb,schema_signature=$15,header_signature=$16,sample_fingerprint=$17,ai_suggested=$18,ai_confidence=$19,user_confirmed=$20,metadata=$21::jsonb,updated_at=NOW() WHERE project_id=$1 AND id=$2 RETURNING *`,[projectId,id,merged.source,merged.reportType,merged.status,merged.isActive,JSON.stringify(merged.columnMapping ?? {}),JSON.stringify(merged.eventMapping ?? {}),JSON.stringify(merged.identityStrategy ?? []),merged.currency ?? null,merged.timezone ?? null,JSON.stringify(merged.kpiRules ?? {}),JSON.stringify(merged.sensitiveFields ?? []),JSON.stringify(merged.dataQualityRules ?? {}),merged.schemaSignature ?? null,merged.headerSignature ?? null,merged.sampleFingerprint ?? null,merged.aiSuggested,merged.aiConfidence ?? null,merged.userConfirmed,JSON.stringify(merged.metadata ?? {})]); return this.toRecord(firstQueryRow(rows)); }
  async confirm(projectId: string, id: string, confirmedBy: string, makeActive: boolean) { const mapping=await this.findByProjectAndId(projectId,id); if(!mapping) throw new Error(`Mapping ${id} not found`); if(makeActive) await this.dataSource.query(`UPDATE project_source_mappings SET status='ARCHIVED', is_active=false, updated_at=NOW() WHERE project_id=$1 AND source=$2 AND report_type=$3 AND schema_signature IS NOT DISTINCT FROM $4 AND id<>$5 AND is_active=true`,[projectId,mapping.source,mapping.reportType,mapping.schemaSignature,id]); const rows=await this.dataSource.query(`UPDATE project_source_mappings SET status=$3,is_active=$4,user_confirmed=true,confirmed_by=$5,confirmed_at=NOW(),updated_at=NOW() WHERE project_id=$1 AND id=$2 RETURNING *`,[projectId,id, makeActive ? MappingProfileStatus.ACTIVE : MappingProfileStatus.CONFIRMED, makeActive, confirmedBy]); return this.toRecord(firstQueryRow(rows)); }
  private toRecord(row: Record<string, any>): ProjectSourceMapping { return { id: row.id, projectId: row.project_id, source: row.source, reportType: row.report_type, version: Number(row.version), status: row.status, isActive: Boolean(row.is_active), columnMapping: row.column_mapping ?? {}, eventMapping: row.event_mapping ?? {}, identityStrategy: row.identity_strategy ?? [], currency: row.currency ?? null, timezone: row.timezone ?? null, kpiRules: row.kpi_rules ?? {}, sensitiveFields: row.sensitive_fields ?? [], dataQualityRules: row.data_quality_rules ?? {}, schemaSignature: row.schema_signature ?? null, headerSignature: row.header_signature ?? null, sampleFingerprint: row.sample_fingerprint ?? null, aiSuggested: Boolean(row.ai_suggested), aiConfidence: row.ai_confidence == null ? null : Number(row.ai_confidence), userConfirmed: Boolean(row.user_confirmed), confirmedBy: row.confirmed_by ?? null, confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null, metadata: row.metadata ?? {}, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() }; }
}
