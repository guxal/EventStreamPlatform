import { EntityType, Severity, type DetectedFact, type TemporalContext } from '@metrics-platform/marketing-shared';
import type { AnalysisMetricRow } from './analysis-input.types';

export abstract class BaseAnalysisPlugin {
  abstract readonly name: string;
  abstract readonly targetEntityType: EntityType;

  abstract evaluateRow(row: AnalysisMetricRow): Omit<DetectedFact, 'entityId' | 'entityType' | 'temporalContext'> | null;

  execute(_projectId: string, timeframe: TemporalContext, rows: AnalysisMetricRow[]): DetectedFact[] {
    return rows
      .filter((row) => row.entityType === this.targetEntityType)
      .map((row) => {
        const result = this.evaluateRow(row);
        if (!result) return null;

        return {
          entityId: row.entityId,
          entityType: row.entityType,
          temporalContext: timeframe,
          ...result,
        };
      })
      .filter((fact): fact is DetectedFact => Boolean(fact));
  }

  protected makeConfidence(score: number): number {
    if (score >= 0.99) return 0.99;
    if (score <= 0.5) return 0.5;
    return Number(score.toFixed(3));
  }

  protected dataQualityWarningHint(): string {
    return 'Data appears incomplete or inconsistent. Validate tracking and CSV fields before optimization.';
  }

  protected defaultSeverityForMissingData(): Severity {
    return Severity.WARNING;
  }
}
