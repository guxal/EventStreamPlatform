import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { firstQueryRow, unwrapQueryRows } from '../../database/typeorm-query.util';

export type SemanticEntityRecord = {
  id: string;
  projectId: string;
  entityType: string;
  canonicalName: string;
  aliases: string[];
  sources: string[];
  metadata: Record<string, unknown>;
  confidence: number;
  createdAt: string;
  updatedAt: string;
};

export type SemanticEntityInput = {
  projectId: string;
  entityType: string;
  canonicalName: string;
  aliases?: string[];
  sources?: string[];
  metadata?: Record<string, unknown>;
  confidence?: number;
};

export type SemanticEntityFilters = {
  source?: string;
  entityType?: string;
  canonicalName?: string;
  importId?: string;
  reportType?: string;
};

@Injectable()
export class SemanticEntityRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findById(projectId: string, id: string): Promise<SemanticEntityRecord | null> {
    const rows = await this.dataSource.query('SELECT * FROM semantic_entities WHERE project_id = $1 AND id = $2 LIMIT 1', [projectId, id]);
    const row = unwrapQueryRows<Record<string, any>>(rows)[0];
    return row ? this.toRecord(row) : null;
  }

  async findByProject(projectId: string): Promise<SemanticEntityRecord[]> {
    const rows = await this.dataSource.query('SELECT * FROM semantic_entities WHERE project_id = $1 ORDER BY entity_type, canonical_name', [projectId]);
    return unwrapQueryRows<Record<string, any>>(rows).map((row) => this.toRecord(row));
  }

  async findOrCreateByCanonicalName(input: SemanticEntityInput): Promise<SemanticEntityRecord> {
    return this.upsertEntity(input);
  }

  async upsertEntity(input: SemanticEntityInput): Promise<SemanticEntityRecord> {
    const canonicalName = this.normalizeName(input.canonicalName);
    const rows = await this.dataSource.query(
      `INSERT INTO semantic_entities (id, project_id, entity_type, canonical_name, aliases, sources, metadata_json, confidence)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)
       ON CONFLICT (project_id, entity_type, canonical_name)
       DO UPDATE SET
         aliases = COALESCE((SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements_text(semantic_entities.aliases || EXCLUDED.aliases) AS value), '[]'::jsonb),
         sources = COALESCE((SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements_text(semantic_entities.sources || EXCLUDED.sources) AS value), '[]'::jsonb),
         metadata_json = semantic_entities.metadata_json || EXCLUDED.metadata_json,
         confidence = GREATEST(semantic_entities.confidence, EXCLUDED.confidence),
         updated_at = NOW()
       RETURNING *`,
      [randomUUID(), input.projectId, input.entityType, canonicalName, JSON.stringify(input.aliases ?? []), JSON.stringify((input.sources ?? []).map((source) => source.toLowerCase())), JSON.stringify(input.metadata ?? {}), input.confidence ?? 1],
    );
    return this.toRecord(firstQueryRow(rows));
  }

  async searchEntities(projectId: string, filters: SemanticEntityFilters = {}): Promise<SemanticEntityRecord[]> {
    const clauses = ['project_id = $1'];
    const params: unknown[] = [projectId];
    if (filters.source) { params.push(filters.source.toLowerCase()); clauses.push(`sources @> to_jsonb(ARRAY[$${params.length}]::text[])`); }
    if (filters.entityType) { params.push(filters.entityType); clauses.push(`entity_type = $${params.length}`); }
    if (filters.canonicalName) { params.push(`%${filters.canonicalName.toLowerCase()}%`); clauses.push(`canonical_name ILIKE $${params.length}`); }
    if (filters.importId) { params.push(filters.importId); clauses.push(`metadata_json->>'importId' = $${params.length}`); }
    if (filters.reportType) { params.push(filters.reportType); clauses.push(`metadata_json->>'reportType' = $${params.length}`); }
    const rows = await this.dataSource.query(`SELECT * FROM semantic_entities WHERE ${clauses.join(' AND ')} ORDER BY entity_type, canonical_name`, params);
    return unwrapQueryRows<Record<string, any>>(rows).map((row) => this.toRecord(row));
  }

  private normalizeName(value: string): string { return String(value || 'unknown').trim().toLowerCase(); }

  private toRecord(row: Record<string, any>): SemanticEntityRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      entityType: row.entity_type,
      canonicalName: row.canonical_name,
      aliases: row.aliases ?? [],
      sources: row.sources ?? [],
      metadata: row.metadata_json ?? {},
      confidence: Number(row.confidence ?? 1),
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
    };
  }

  private toIso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
}
