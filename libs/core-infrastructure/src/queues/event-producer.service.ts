import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class EventProducerService implements OnModuleInit, OnModuleDestroy {
  public eventQueue!: Queue;
  public marketingImportsQueue!: Queue;
  public marketingAnalysisQueue!: Queue;
  public projectAnalysisQueue!: Queue;

  onModuleInit() {
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    };

    this.eventQueue = new Queue('events', { connection });
    this.marketingImportsQueue = new Queue('marketing-imports', { connection });
    this.marketingAnalysisQueue = new Queue('marketing-analysis', { connection });
    this.projectAnalysisQueue = new Queue('project-analysis', { connection });
  }

  async onModuleDestroy() {
    await Promise.all([this.eventQueue.close(), this.marketingImportsQueue.close(), this.marketingAnalysisQueue.close(), this.projectAnalysisQueue.close()]);
  }

  async publishEvent(data: unknown) {
    await this.eventQueue.add('event', data);
  }

  async publishMarketingAnalysis(data: unknown) {
    await this.marketingAnalysisQueue.add('generate-ai-analysis', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  async publishProjectGoldRecompute(data: unknown) {
    const job = await this.projectAnalysisQueue.add('recompute-project-gold', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    return job;
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
