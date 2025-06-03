import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventOrmEntity } from './entities/event.orm-entity';
import { MetricOrmEntity } from './entities/metric.orm-entity';
import { EventRepository } from './repositories/event.repository';
import { MetricRepository } from './repositories/metric.repository';
import { RedisService } from '../redis/redis.service';
import { MetricsRepository } from './repositories/metrics.repository';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'metricsdb',
      autoLoadEntities: true,
      synchronize: true, // ¡Quita esto en producción!
    }),
    TypeOrmModule.forFeature([EventOrmEntity, MetricOrmEntity]),
  ],
  providers: [EventRepository, MetricRepository, MetricsRepository, RedisService],
  exports: [EventRepository, MetricRepository, MetricsRepository, RedisService],
})
export class DatabaseModule {}
