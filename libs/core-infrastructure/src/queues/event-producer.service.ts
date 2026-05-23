import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class EventProducerService implements OnModuleInit, OnModuleDestroy {
  public eventQueue!: Queue;
  public marketingImportsQueue!: Queue;

  onModuleInit() {
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    };

    this.eventQueue = new Queue('events', { connection });
    this.marketingImportsQueue = new Queue('marketing-imports', { connection });
  }

  async onModuleDestroy() {
    await Promise.all([this.eventQueue.close(), this.marketingImportsQueue.close()]);
  }

  async publishEvent(data: unknown) {
    await this.eventQueue.add('event', data);
  }

  async publishMarketingImport(data: unknown) {
    await this.marketingImportsQueue.add('process-marketing-import', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
