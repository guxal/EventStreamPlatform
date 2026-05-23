import { EntityType, FactType, Severity, type DetectedFact } from '@metrics-platform/marketing-shared';
import { BaseAnalysisPlugin } from './base-analysis-plugin';
import { DEFAULT_ANALYSIS_THRESHOLDS, type AnalysisMetricRow, type AnalysisThresholds } from './analysis-input.types';

class HighSpendZeroConversionsPlugin extends BaseAnalysisPlugin {
  readonly name = 'HIGH_SPEND_ZERO_CONVERSIONS';
  readonly targetEntityType = EntityType.CAMPAIGN;

  constructor(private readonly t: AnalysisThresholds) { super(); }

  evaluateRow(row: AnalysisMetricRow): Omit<DetectedFact, 'entityId' | 'entityType' | 'temporalContext'> | null {
    if (row.cost >= this.t.highSpendThreshold && row.conversions === 0) {
      return {
        factType: FactType.HIGH_SPEND_ZERO_CONVERSIONS,
        severity: Severity.CRITICAL,
        confidence: this.makeConfidence(0.98),
        metricsSummary: { currentSpend: row.cost, clicks: row.clicks, conversions: row.conversions },
        recommendationHint: 'High spend with zero conversions. Review targeting, search terms, and landing page quality.',
      };
    }
    return null;
  }
}

class LowCtrPlugin extends BaseAnalysisPlugin {
  readonly name = 'LOW_CTR';
  readonly targetEntityType = EntityType.CAMPAIGN;
  constructor(private readonly t: AnalysisThresholds) { super(); }
  evaluateRow(row: AnalysisMetricRow) {
    if (row.impressions > 0 && row.ctr < this.t.lowCtrThreshold) {
      return {
        factType: FactType.LOW_CTR,
        severity: Severity.WARNING,
        confidence: this.makeConfidence(0.9),
        metricsSummary: { ctr: row.ctr, impressions: row.impressions, clicks: row.clicks },
        recommendationHint: 'CTR below threshold. Improve ad copy relevance and audience targeting.',
      };
    }
    return null;
  }
}

class HighCpcPlugin extends BaseAnalysisPlugin {
  readonly name = 'HIGH_CPC';
  readonly targetEntityType = EntityType.CAMPAIGN;
  constructor(private readonly t: AnalysisThresholds) { super(); }
  evaluateRow(row: AnalysisMetricRow) {
    if (row.cpc > this.t.highCpcThreshold) {
      return {
        factType: FactType.HIGH_CPC,
        severity: Severity.WARNING,
        confidence: this.makeConfidence(0.88),
        metricsSummary: { cpc: row.cpc, cost: row.cost, clicks: row.clicks },
        recommendationHint: 'CPC is high. Review bidding strategy, match types, and keyword competition.',
      };
    }
    return null;
  }
}

class HighCpaPlugin extends BaseAnalysisPlugin {
  readonly name = 'HIGH_CPA';
  readonly targetEntityType = EntityType.CAMPAIGN;
  constructor(private readonly t: AnalysisThresholds) { super(); }
  evaluateRow(row: AnalysisMetricRow) {
    if (row.conversions > 0 && row.cpa > this.t.highCpaThreshold) {
      return {
        factType: FactType.HIGH_CPA,
        severity: Severity.WARNING,
        confidence: this.makeConfidence(0.89),
        metricsSummary: { cpa: row.cpa, conversions: row.conversions, cost: row.cost },
        recommendationHint: 'CPA is above target. Refine funnel and prioritize higher-intent segments.',
      };
    }
    return null;
  }
}

class LowRoasPlugin extends BaseAnalysisPlugin {
  readonly name = 'LOW_ROAS';
  readonly targetEntityType = EntityType.CAMPAIGN;
  constructor(private readonly t: AnalysisThresholds) { super(); }
  evaluateRow(row: AnalysisMetricRow) {
    if (row.cost > 0 && row.roas < this.t.lowRoasThreshold) {
      return {
        factType: FactType.LOW_ROAS,
        severity: Severity.CRITICAL,
        confidence: this.makeConfidence(0.95),
        metricsSummary: { roas: row.roas, cost: row.cost, conversionValue: row.conversionValue },
        recommendationHint: 'ROAS is below threshold. Reallocate budget to stronger campaigns and optimize creatives.',
      };
    }
    return null;
  }
}

class KeywordWastePlugin extends BaseAnalysisPlugin {
  readonly name = 'KEYWORD_WASTE';
  readonly targetEntityType = EntityType.KEYWORD;
  constructor(private readonly t: AnalysisThresholds) { super(); }
  evaluateRow(row: AnalysisMetricRow) {
    if (row.cost >= this.t.keywordWasteSpendThreshold && row.conversions === 0) {
      return {
        factType: FactType.KEYWORD_WASTE,
        severity: Severity.CRITICAL,
        confidence: this.makeConfidence(0.96),
        metricsSummary: { cost: row.cost, clicks: row.clicks, conversions: row.conversions },
        recommendationHint: 'Keyword spend with no conversions. Add negatives or pause non-performing terms.',
      };
    }
    return null;
  }
}

class ScalingOpportunityPlugin extends BaseAnalysisPlugin {
  readonly name = 'SCALING_OPPORTUNITY';
  readonly targetEntityType = EntityType.CAMPAIGN;
  constructor(private readonly t: AnalysisThresholds) { super(); }
  evaluateRow(row: AnalysisMetricRow) {
    if (row.roas >= this.t.scalingOpportunityRoasThreshold && row.conversions >= this.t.scalingOpportunityConversionsThreshold) {
      return {
        factType: FactType.SCALING_OPPORTUNITY,
        severity: Severity.INFO,
        confidence: this.makeConfidence(0.86),
        metricsSummary: { roas: row.roas, conversions: row.conversions, conversionValue: row.conversionValue },
        recommendationHint: 'Strong efficiency and conversion volume. Consider controlled budget scaling.',
      };
    }
    return null;
  }
}

class DataQualityWarningPlugin extends BaseAnalysisPlugin {
  readonly name = 'DATA_QUALITY_WARNING';
  readonly targetEntityType = EntityType.CAMPAIGN;
  evaluateRow(row: AnalysisMetricRow) {
    const invalid = row.clicks > row.impressions || row.cost < 0 || row.conversions < 0 || row.ctr < 0;
    if (invalid) {
      return {
        factType: FactType.DATA_QUALITY_WARNING,
        severity: this.defaultSeverityForMissingData(),
        confidence: this.makeConfidence(0.92),
        metricsSummary: { impressions: row.impressions, clicks: row.clicks, cost: row.cost, conversions: row.conversions, ctr: row.ctr },
        recommendationHint: this.dataQualityWarningHint(),
      };
    }
    return null;
  }
}

export const createAnalysisPlugins = (thresholds: AnalysisThresholds = DEFAULT_ANALYSIS_THRESHOLDS) => [
  new HighSpendZeroConversionsPlugin(thresholds),
  new LowCtrPlugin(thresholds),
  new HighCpcPlugin(thresholds),
  new HighCpaPlugin(thresholds),
  new LowRoasPlugin(thresholds),
  new KeywordWastePlugin(thresholds),
  new ScalingOpportunityPlugin(thresholds),
  new DataQualityWarningPlugin(),
];
