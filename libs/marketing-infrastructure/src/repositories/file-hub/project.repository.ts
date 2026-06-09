import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type MarketingProjectRecord = {
  id: string;
  name: string;
  description?: string;
  defaultCurrency: string;
  timezone: string;
  createdAt: string;
};

@Injectable()
export class ProjectRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(input: {
    id: string;
    name: string;
    description?: string;
    defaultCurrency: string;
    timezone: string;
  }): Promise<MarketingProjectRecord> {
    const rows = await this.dataSource.query(
      `INSERT INTO projects (id, name, description, default_currency, timezone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.id, input.name, input.description ?? null, input.defaultCurrency, input.timezone],
    );
    return this.toRecord(rows[0]);
  }

  async exists(projectId: string): Promise<boolean> {
    const rows = await this.dataSource.query('SELECT 1 FROM projects WHERE id = $1 LIMIT 1', [projectId]);
    return rows.length > 0;
  }

  async list(): Promise<MarketingProjectRecord[]> {
    const rows = await this.dataSource.query('SELECT * FROM projects ORDER BY created_at DESC');
    return rows.map((row: Record<string, unknown>) => this.toRecord(row));
  }

  private toRecord(row: Record<string, any>): MarketingProjectRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      defaultCurrency: row.default_currency ?? 'USD',
      timezone: row.timezone ?? 'UTC',
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    };
  }
}
