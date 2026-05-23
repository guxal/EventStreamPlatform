import { EntityType } from '../enums/entity-type.enum';
import { DetectedFact } from './detected-fact.contract';
import { TemporalContext } from '../types/temporal-context.type';

export interface IAnalysisPlugin {
  name: string;
  targetEntityType: EntityType;
  execute(projectId: string, timeframe: TemporalContext): Promise<DetectedFact[]>;
}
