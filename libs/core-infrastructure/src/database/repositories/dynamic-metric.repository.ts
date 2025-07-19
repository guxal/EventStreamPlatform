import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DynamicMetricDto } from '@metrics-platform/core-shared';
import { DynamicMetricOrmEntity } from '../entities/dynamic-metric.orm-entity';

@Injectable()
export class DynamicMetricRepository {
  constructor(
    @InjectRepository(DynamicMetricOrmEntity)
    private readonly repo: Repository<DynamicMetricOrmEntity>
  ) {}

  async create(metric: DynamicMetricDto): Promise<DynamicMetricOrmEntity> {
    return this.repo.save(metric);
  }

  async update(id: string, dto: Partial<DynamicMetricDto>): Promise<DynamicMetricOrmEntity | null> {
    await this.repo.update(id, dto);
    return this.repo.findOne({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async findByName(name: string): Promise<DynamicMetricOrmEntity | null> {
    return this.repo.findOne({ where: { name } });
  }

  async findAll(): Promise<DynamicMetricOrmEntity[]> {
    return this.repo.find();
  }
}
