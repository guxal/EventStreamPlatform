import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
//import { EventsQueueProcessor } from './events.queue';
import { EventProducerService } from './event-producer.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    BullModule.registerQueue({ name: 'events' }),
    BullModule.registerQueue({ name: 'marketing-imports' }),
    BullModule.registerQueue({ name: 'marketing-analysis' }),
  ],
  providers: [EventProducerService],
  exports: [EventProducerService],
})
export class QueueModule {}
