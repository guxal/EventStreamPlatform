import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RecommendationRepository } from '../ai/recommendation.repository';

@Injectable()
export class RecommendationsReaderRepository extends RecommendationRepository {
  constructor(@InjectDataSource() dataSource: DataSource) { super(dataSource); }
}
