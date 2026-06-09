import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { firstQueryRow, unwrapQueryRows } from '../../database/typeorm-query.util';
import type { SemanticEntityRecord } from './semantic-entity.repository';

export type SemanticRelationshipRecord = {
  id: string;
  projectId: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourceEntity?: SemanticEntityRecord;
  targetEntity?: SemanticEntityRecord;
  relationshipType: string;
  confidence: number;
  source?: string | null;
  reportType?: string | null;
  importId?: string | null;
  rawFileId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SemanticRelationshipInput = {
  projectId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: string;
  confidence?: number;
  source?: string;
  reportType?: string;
  importId?: string;
  rawFileId?: string;
  metadata?: Record<string, unknown>;
};

export type SemanticRelationshipFilters = {
  source?: string;
  relationshipType?: string;
  sourceEntityId?: string;
  targetEntityId?: string;
  importId?: string;
  reportType?: string;
};

@Injectable()
export class SemanticRelationshipRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findById(projectId: string, id: string): Promise<SemanticRelationshipRecord | null> {
    const rows = await this.dataSource.query('SELECT * FROM semantic_relationships WHERE project_id = $1 AND id = $2 LIMIT 1', [projectId, id]);
    const row = unwrapQueryRows<Record<string, any>>(rows)[0];
    return row ? this.toRecord(row) : null;
  }

  async findByProject(projectId: string): Promise<SemanticRelationshipRecord[]> {
    return this.searchRelationships(projectId);
  }

  async upsertRelationship(input: SemanticRelationshipInput): Promise<SemanticRelationshipRecord> {
    const existingRows = await this.dataSource.query(
      `SELECT id FROM semantic_relationships
       WHERE project_id = $1 AND source_entity_id = $2 AND target_entity_id = $3 AND relationship_type = $4
         AND source IS NOT DISTINCT FROM $5
         AND report_type IS NOT DISTINCT FROM $6
       LIMIT 1`,
      [input.projectId, input.sourceEntityId, input.targetEntityId, input.relationshipType, input.source ?? null, input.reportType ?? null],
    );
    const existing = unwrapQueryRows<Record<string, any>>(existingRows)[0];
    if (existing) {
      const rows = await this.dataSource.query(
        `UPDATE semantic_relationships
         SET confidence = GREATEST(confidence, $2),
             metadata_json = metadata_json || $3::jsonb,
             import_id = COALESCE(import_id, $4::uuid),
             raw_file_id = COALESCE(raw_file_id, $5::uuid),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.id, input.confidence ?? 1, JSON.stringify(input.metadata ?? {}), input.importId ?? null, input.rawFileId ?? null],
      );
      return this.toRecord(firstQueryRow(rows));
    }

    const rows = await this.dataSource.query(
      `INSERT INTO semantic_relationships (id, project_id, source_entity_id, target_entity_id, relationship_type, confidence, source, report_type, import_id, raw_file_id, metadata_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10::uuid, $11::jsonb)
       RETURNING *`,
      [randomUUID(), input.projectId, input.sourceEntityId, input.targetEntityId, input.relationshipType, input.confidence ?? 1, input.source ?? null, input.reportType ?? null, input.importId ?? null, input.rawFileId ?? null, JSON.stringify(input.metadata ?? {})],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async findRelationshipsForEntity(projectId: string, entityId: string): Promise<SemanticRelationshipRecord[]> {
    const rows = await this.dataSource.query(
      `SELECT r.*, row_to_json(se)::jsonb AS source_entity, row_to_json(te)::jsonb AS target_entity
       FROM semantic_relationships r
       JOIN semantic_entities se ON se.id = r.source_entity_id
       JOIN semantic_entities te ON te.id = r.target_entity_id
       WHERE r.project_id = $1 AND (r.source_entity_id = $2 OR r.target_entity_id = $2)
       ORDER BY r.created_at DESC`,
      [projectId, entityId],
    );
    return unwrapQueryRows<Record<string, any>>(rows).map((row) => this.toRecord(row));
  }

  async searchRelationships(projectId: string, filters: SemanticRelationshipFilters = {}): Promise<SemanticRelationshipRecord[]> {
    const clauses = ['r.project_id = $1'];
    const params: unknown[] = [projectId];
    if (filters.source) { params.push(filters.source.toLowerCase()); clauses.push(`LOWER(COALESCE(r.source, '')) = $${params.length}`); }
    if (filters.relationshipType) { params.push(filters.relationshipType); clauses.push(`r.relationship_type = $${params.length}`); }
    if (filters.sourceEntityId) { params.push(filters.sourceEntityId); clauses.push(`r.source_entity_id = $${params.length}`); }
    if (filters.targetEntityId) { params.push(filters.targetEntityId); clauses.push(`r.target_entity_id = $${params.length}`); }
    if (filters.importId) { params.push(filters.importId); clauses.push(`r.import_id::text = $${params.length}`); }
    if (filters.reportType) { params.push(filters.reportType); clauses.push(`r.report_type = $${params.length}`); }
    const rows = await this.dataSource.query(
      `SELECT r.*, row_to_json(se)::jsonb AS source_entity, row_to_json(te)::jsonb AS target_entity
       FROM semantic_relationships r
       JOIN semantic_entities se ON se.id = r.source_entity_id
       JOIN semantic_entities te ON te.id = r.target_entity_id
       WHERE ${clauses.join(' AND ')} ORDER BY r.created_at DESC`,
      params,
    );
    return unwrapQueryRows<Record<string, any>>(rows).map((row) => this.toRecord(row));
  }

  private toRecord(row: Record<string, any>): SemanticRelationshipRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      sourceEntityId: row.source_entity_id,
      targetEntityId: row.target_entity_id,
      sourceEntity: row.source_entity ? this.toEntity(row.source_entity) : undefined,
      targetEntity: row.target_entity ? this.toEntity(row.target_entity) : undefined,
      relationshipType: row.relationship_type,
      confidence: Number(row.confidence ?? 1),
      source: row.source ?? null,
      reportType: row.report_type ?? null,
      importId: row.import_id ?? null,
      rawFileId: row.raw_file_id ?? null,
      metadata: row.metadata_json ?? {},
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
    };
  }

  private toEntity(row: Record<string, any>): SemanticEntityRecord {
    return { id: row.id, projectId: row.project_id, entityType: row.entity_type, canonicalName: row.canonical_name, aliases: row.aliases ?? [], sources: row.sources ?? [], metadata: row.metadata_json ?? {}, confidence: Number(row.confidence ?? 1), createdAt: this.toIso(row.created_at), updatedAt: this.toIso(row.updated_at) };
  }

  private toIso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
}
