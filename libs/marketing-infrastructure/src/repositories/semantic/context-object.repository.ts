import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { firstQueryRow, unwrapQueryRows } from '../../database/typeorm-query.util';

export type ContextObjectRecord = {
  id: string;
  projectId: string;
  contextType: string;
  title: string;
  content: string;
  source?: string | null;
  reportType?: string | null;
  entityId?: string | null;
  confidence: number;
  validFrom?: string | null;
  validTo?: string | null;
  isSystemGenerated: boolean;
  createdBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ContextObjectInput = {
  projectId: string;
  contextType: string;
  title: string;
  content: string;
  source?: string;
  reportType?: string;
  entityId?: string;
  confidence?: number;
  validFrom?: string;
  validTo?: string;
  isSystemGenerated?: boolean;
  createdBy?: string;
  metadata?: Record<string, unknown>;
};

export type ContextObjectFilters = {
  source?: string;
  contextType?: string;
  entityId?: string;
  reportType?: string;
  validAt?: string;
};

@Injectable()
export class ContextObjectRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findById(projectId: string, id: string): Promise<ContextObjectRecord | null> {
    const rows = await this.dataSource.query('SELECT * FROM context_objects WHERE project_id = $1 AND id = $2 LIMIT 1', [projectId, id]);
    const row = unwrapQueryRows<Record<string, any>>(rows)[0];
    return row ? this.toRecord(row) : null;
  }

  async findByProject(projectId: string): Promise<ContextObjectRecord[]> {
    return this.searchContextObjects(projectId);
  }

  async createContextObject(input: ContextObjectInput): Promise<ContextObjectRecord> {
    return this.upsertContextObject(input);
  }

  async upsertContextObject(input: ContextObjectInput): Promise<ContextObjectRecord> {
    const existingRows = await this.dataSource.query(
      `SELECT id FROM context_objects
       WHERE project_id = $1 AND context_type = $2 AND title = $3
         AND source IS NOT DISTINCT FROM $4
         AND report_type IS NOT DISTINCT FROM $5
         AND entity_id IS NOT DISTINCT FROM $6::uuid
       LIMIT 1`,
      [input.projectId, input.contextType, input.title, input.source ?? null, input.reportType ?? null, input.entityId ?? null],
    );
    const existing = unwrapQueryRows<Record<string, any>>(existingRows)[0];
    if (existing) {
      const rows = await this.dataSource.query(
        `UPDATE context_objects
         SET content = $2,
             confidence = GREATEST(confidence, $3),
             metadata_json = metadata_json || $4::jsonb,
             valid_from = COALESCE(valid_from, $5::timestamptz),
             valid_to = COALESCE(valid_to, $6::timestamptz),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.id, input.content, input.confidence ?? 1, JSON.stringify(input.metadata ?? {}), input.validFrom ?? null, input.validTo ?? null],
      );
      return this.toRecord(firstQueryRow(rows));
    }

    const rows = await this.dataSource.query(
      `INSERT INTO context_objects (id, project_id, context_type, title, content, source, report_type, entity_id, confidence, valid_from, valid_to, is_system_generated, created_by, metadata_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::uuid, $9, $10::timestamptz, $11::timestamptz, $12, $13, $14::jsonb)
       RETURNING *`,
      [randomUUID(), input.projectId, input.contextType, input.title, input.content, input.source ?? null, input.reportType ?? null, input.entityId ?? null, input.confidence ?? 1, input.validFrom ?? null, input.validTo ?? null, input.isSystemGenerated ?? true, input.createdBy ?? 'system', JSON.stringify(input.metadata ?? {})],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async searchContextObjects(projectId: string, filters: ContextObjectFilters = {}): Promise<ContextObjectRecord[]> {
    const clauses = ['project_id = $1'];
    const params: unknown[] = [projectId];
    if (filters.source) { params.push(filters.source.toLowerCase()); clauses.push(`LOWER(COALESCE(source, '')) = $${params.length}`); }
    if (filters.contextType) { params.push(filters.contextType); clauses.push(`context_type = $${params.length}`); }
    if (filters.entityId) { params.push(filters.entityId); clauses.push(`entity_id = $${params.length}`); }
    if (filters.reportType) { params.push(filters.reportType); clauses.push(`report_type = $${params.length}`); }
    if (filters.validAt) { params.push(filters.validAt); clauses.push(`(valid_from IS NULL OR valid_from <= $${params.length}) AND (valid_to IS NULL OR valid_to >= $${params.length})`); }
    const rows = await this.dataSource.query(`SELECT * FROM context_objects WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, params);
    return unwrapQueryRows<Record<string, any>>(rows).map((row) => this.toRecord(row));
  }

  private toRecord(row: Record<string, any>): ContextObjectRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      contextType: row.context_type,
      title: row.title,
      content: row.content,
      source: row.source ?? null,
      reportType: row.report_type ?? null,
      entityId: row.entity_id ?? null,
      confidence: Number(row.confidence ?? 1),
      validFrom: row.valid_from ? this.toIso(row.valid_from) : null,
      validTo: row.valid_to ? this.toIso(row.valid_to) : null,
      isSystemGenerated: Boolean(row.is_system_generated),
      createdBy: row.created_by ?? null,
      metadata: row.metadata_json ?? {},
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
    };
  }

  private toIso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
}
