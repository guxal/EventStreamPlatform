import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EventsQueueProcessor } from './events.queue';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    BullModule.registerQueue({ name: 'events' }),
  ],
  providers: [EventsQueueProcessor],
  exports: [],
})
export class QueueModule {}
