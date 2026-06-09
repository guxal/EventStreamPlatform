import { Injectable, NotFoundException } from '@nestjs/common';
import { ProcessAuditRepository } from '@metrics-platform/marketing-infrastructure';

@Injectable()
export class AppService {
  constructor(private readonly processAuditRepository: ProcessAuditRepository) {}

  getData(): { message: string } {
    return { message: 'EventStream Platform Admin API' };
  }

  listProjectProcesses(projectId: string, limit?: string) {
    return this.processAuditRepository.listRunsByProject(projectId, limit ? Number(limit) : 50);
  }

  async getProjectProcess(projectId: string, runId: string) {
    const run = await this.processAuditRepository.getRunWithSteps(projectId, runId);
    if (!run) throw new NotFoundException(`Process run ${runId} not found for project ${projectId}`);
    return run;
  }
}
