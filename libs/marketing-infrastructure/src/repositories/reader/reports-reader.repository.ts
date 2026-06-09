import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AiReportRepository } from '../ai/ai-report.repository';

@Injectable()
export class ReportsReaderRepository extends AiReportRepository {
  constructor(@InjectDataSource() dataSource: DataSource) { super(dataSource); }
}
