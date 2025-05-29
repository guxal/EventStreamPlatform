import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';

@Processor('events')
export class EventsQueueProcessor {
  @Process('event-job')
  async handleEventJob(job: Job) {
    // Lógica para procesar eventos en background
  }
}
