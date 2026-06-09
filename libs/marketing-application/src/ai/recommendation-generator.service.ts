import { Injectable } from '@nestjs/common';
import type { DetectedFact, FactType } from '@metrics-platform/marketing-shared';

export type GeneratedRecommendation = {
  title: string;
  body: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factType: FactType;
};

@Injectable()
export class RecommendationGeneratorService {
  generateFromFacts(facts: DetectedFact[]): GeneratedRecommendation[] {
    return facts.map((fact) => ({
      title: `Action for ${fact.factType}`,
      body:
        fact.recommendationHint ||
        `Review ${fact.entityType} (${fact.entityId}) due to ${fact.factType} in selected period.`,
      priority: this.mapSeverityToPriority(fact.severity),
      factType: fact.factType,
    }));
  }

  private mapSeverityToPriority(
    severity: DetectedFact['severity'],
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (severity === 'CRITICAL') return 'CRITICAL';
    if (severity === 'WARNING') return 'HIGH';
    if (severity === 'INFO') return 'MEDIUM';
    return 'LOW';
  }
}
