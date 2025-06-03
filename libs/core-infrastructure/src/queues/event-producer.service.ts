import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class EventProducerService implements OnModuleInit, OnModuleDestroy {
  // Using definite assignment assertion (!) because client is initialized in onModuleInit()
  public eventQueue!: Queue;

  onModuleInit() {
    this.eventQueue = new Queue('events', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        // password, db, etc si usas más configs
      },
    });
  }

  async onModuleDestroy() {
    await this.eventQueue.close();
  }

  async publishEvent(data: any) {
    await this.eventQueue.add('event', data); // 'event' es el nombre del job/type
  }
}