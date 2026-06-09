import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type DataImportRecord = {
  id: string;
  projectId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
};

@Injectable()
export class DataImportRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createForRawFile(input: { id: string; projectId: string; rawFileId: string }): Promise<DataImportRecord> {
    const rows = await this.dataSource.query(
      `INSERT INTO data_imports (id, project_id, import_type, status, started_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [input.id, input.projectId, 'CSV', 'PROCESSING'],
    );

    return {
      id: rows[0].id,
      projectId: rows[0].project_id,
      status: rows[0].status,
      createdAt: this.toIso(rows[0].created_at),
    };
  }

  private toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
