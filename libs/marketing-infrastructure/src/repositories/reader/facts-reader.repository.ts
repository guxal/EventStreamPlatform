import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DetectedFactRepository } from '../marketing/detected-fact.repository';

@Injectable()
export class FactsReaderRepository extends DetectedFactRepository {
  constructor(@InjectDataSource() dataSource: DataSource) { super(dataSource); }
}
