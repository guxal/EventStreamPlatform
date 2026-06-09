import { EntityType } from '../enums/entity-type.enum';
import { FactType } from '../enums/fact-type.enum';
import { Severity } from '../enums/severity.enum';
import { TemporalContext } from '../types/temporal-context.type';

export type DetectedFact = {
  id?: string;
  entityId: string;
  entityType: EntityType;
  factType: FactType;
  severity: Severity;
  confidence: number;
  temporalContext: TemporalContext;
  metricsSummary: Record<string, unknown>;
  recommendationHint?: string;
  semanticEntityId?: string;
  relatedSemanticEntityIds?: string[];
  contextObjectIds?: string[];
};
