import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventOrmEntity } from '../entities/event.orm-entity';

@Injectable()
export class EventRepository {
  constructor(
    @InjectRepository(EventOrmEntity)
    private readonly repo: Repository<EventOrmEntity>
  ) {}

  async save(event: Partial<EventOrmEntity>): Promise<EventOrmEntity> {
    return this.repo.save(event);
  }

  // Agrega métodos para consultar eventos si es necesario
}
