import { Injectable, OnModuleInit } from '@nestjs/common';
import { AiAnalysisRunnerService } from '@metrics-platform/marketing-application';
import type { MarketingAiAnalysisJobPayload } from '@metrics-platform/marketing-shared';
import { startQueueConsumer } from '../queue/queue.consumer';

@Injectable()
export class AiAnalysisProcessor implements OnModuleInit {
  constructor(private readonly runner: AiAnalysisRunnerService) {}

  onModuleInit() {
    startQueueConsumer('marketing-analysis', async (payload: MarketingAiAnalysisJobPayload, job?: { name?: string }) => {
      if (job?.name && job.name !== 'generate-ai-analysis') return;
      await this.runner.process(payload);
    });
  }
}
