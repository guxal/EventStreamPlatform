import { Injectable } from '@nestjs/common';
import type { AiReportRecord } from '@metrics-platform/marketing-shared';

@Injectable()
export class AiReportRepository {
  private readonly records: AiReportRecord[] = [];

  save(item: AiReportRecord): AiReportRecord {
    this.records.push(item);
    return item;
  }

  listByProject(projectId: string): AiReportRecord[] {
    return this.records.filter((item) => item.projectId === projectId);
  }
}
