import { Injectable } from '@nestjs/common';
import type { RecommendationRecord } from '@metrics-platform/marketing-shared';

@Injectable()
export class RecommendationRepository {
  private readonly records: RecommendationRecord[] = [];

  saveMany(items: RecommendationRecord[]): RecommendationRecord[] {
    this.records.push(...items);
    return items;
  }

  listByProject(projectId: string): RecommendationRecord[] {
    return this.records.filter((item) => item.projectId === projectId);
  }
}
