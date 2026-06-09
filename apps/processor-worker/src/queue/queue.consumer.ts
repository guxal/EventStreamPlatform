// queue/queue.consumer.ts
import { Worker, QueueEvents, Job } from 'bullmq';
import { Logger } from '@nestjs/common';

const logger = new Logger('QueueConsumer');

// Función para iniciar el consumer dinámicamente
export function startQueueConsumer(queueName: string, handler: (event: any) => Promise<void>) {
  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  };

  new Worker(
    queueName,
    async (job: Job) => {
      await handler(job.data);
    },
    {
      connection,
    },
  );

  // Opcional: log de eventos importantes
  const queueEvents = new QueueEvents(queueName, { connection });
  queueEvents.on('completed', ({ jobId }) => {
    logger.log(`Job ${jobId} completado en ${queueName}`);
  });
  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error(`Job ${jobId} falló en ${queueName}: ${failedReason}`);
  });

  logger.log(`Consumer registrado y escuchando en la cola "${queueName}"`);
}
