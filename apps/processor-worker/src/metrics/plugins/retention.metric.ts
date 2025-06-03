// plugins/retention.metric.ts

// Batch: calcula y refresca la vista materializada de retención
export async function refreshRetentionBatch(): Promise<void> {
    const dataSource = /* obtiene instancia */;
    await dataSource.query('REFRESH MATERIALIZED VIEW retention_metrics');
    console.log('[RETENTION BATCH] Refrescada la vista retention_metrics');
  }
  
  // Realtime: procesa evento para actualizar retención (ejemplo placeholder)
  export async function processRetentionRealtime(event: any): Promise<void> {
    if (event.userId && event.timestamp) {
      // Aplica tu lógica de retención aquí (ejemplo: setear flag en Redis)
      // const redis = getRedisInstance();
      // await redis.set(`user-retention:${event.userId}`, event.timestamp);
      console.log(`[RETENTION REALTIME] Procesado retención para ${event.userId}`);
    }
  }
  