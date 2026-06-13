import { Injectable, OnModuleInit } from '@nestjs/common';
import { ProjectGoldRecomputeService } from '@metrics-platform/marketing-application';
import type { ProjectGoldRecomputeJobPayload } from '@metrics-platform/marketing-shared';
import { startQueueConsumer } from '../queue/queue.consumer';

@Injectable()
export class ProjectGoldProcessor implements OnModuleInit {
  constructor(private readonly recomputeService: ProjectGoldRecomputeService) {}

  onModuleInit() {
    startQueueConsumer('project-analysis', async (payload: ProjectGoldRecomputeJobPayload, job?: { name?: string }) => {
      if (job?.name && job.name !== 'recompute-project-gold') return;
      await this.recomputeService.process(payload);
    });
  }
}
