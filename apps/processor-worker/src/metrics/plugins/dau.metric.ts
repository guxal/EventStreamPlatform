// plugins/dau.metric.ts
import { Injectable } from '@nestjs/common';
//import { EventRepository } from '@metrics-platform/core-infrastructure'; // Tu repo centralizado
import { RedisService } from '@metrics-platform/core-infrastructure'; // Ejemplo de servicio Redis, si lo tienes
import { DataSource } from 'typeorm'; // Solo si usas queries raw

@Injectable()
export class DAUMetricPlugin {
  constructor(
    //private readonly eventRepository: EventRepository,
    private readonly redisService: RedisService,      // O el helper que uses para cache DAU
    private readonly dataSource: DataSource           // Si quieres usar SQL directo (opcional)
  ) {}

  // Batch: actualiza vista materializada DAU
  async refreshDailyActiveUsers(): Promise<void> {
    // Opcional: usando raw SQL con TypeORM (ejemplo)
    await this.dataSource.query('REFRESH MATERIALIZED VIEW daily_active_users');
    // O: await this.eventRepository.refreshDailyActiveUsersView();
    console.log('[DAU BATCH] Refrescada la vista daily_active_users');
  }

  // Realtime: procesa un solo evento, actualiza DAU en Redis
  async processDauRealtime(event: any): Promise<void> {
    if (event.userId && event.timestamp) {
      const date = event.timestamp.split('T')[0]; // YYYY-MM-DD
      const key = `dau:${date}`;
      await this.redisService.sadd(key, event.userId);
      await this.redisService.expire(key, 172800); // 2 días
      console.log(`[DAU REALTIME] Procesado usuario ${event.userId} para fecha ${date}`);
    }
  }
}
