import { Injectable } from '@nestjs/common';
import type { DetectedFact, TemporalContext } from '@metrics-platform/marketing-shared';
import { createAnalysisPlugins } from './rules.plugins';
import type { AnalysisMetricRow, AnalysisThresholds } from './analysis-input.types';

@Injectable()
export class AnalysisEngineService {
  run(projectId: string, timeframe: TemporalContext, rows: AnalysisMetricRow[], thresholds?: AnalysisThresholds): DetectedFact[] {
    const plugins = createAnalysisPlugins(thresholds);
    return plugins.flatMap((plugin) => plugin.execute(projectId, timeframe, rows));
  }
}
