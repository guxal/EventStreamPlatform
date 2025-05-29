import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricOrmEntity } from '../entities/metric.orm-entity';

@Injectable()
export class MetricRepository {
  constructor(
    @InjectRepository(MetricOrmEntity)
    private readonly repo: Repository<MetricOrmEntity>
  ) {}

  async save(metric: Partial<MetricOrmEntity>): Promise<MetricOrmEntity> {
    return this.repo.save(metric);
  }

  async findOneByTypeAndPeriod(type: string, period: string) {
    return this.repo.findOne({ where: { metricType: type, period } });
  }

  // Otros métodos para queries por rango, etc.
}
