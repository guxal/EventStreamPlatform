import { Injectable, Optional } from '@nestjs/common';
import type {
  DetectedFact,
  FactType,
} from '@metrics-platform/marketing-shared';
import {
  AI_DEFENSIVE_SYSTEM_PROMPT,
  AI_OUTPUT_JSON_RULES,
} from './ai-safety.constants';
import type { AiMarketingContext } from './context';
import type { AiProvider } from './providers';
import { AiDebugLoggerService } from './debug';

export type GeneratedRecommendation = {
  title: string;
  body: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factType: FactType;
  summary?: string;
  relatedFactIds?: string[];
  relatedEntityIds?: string[];
  source?: string;
  reportType?: string;
  recommendedActions?: string[];
  limitations?: string[];
  confidence?: number;
  rawAiOutput?: unknown;
};

export type AiRecommendationOutput = {
  title: string;
  summary: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  relatedFactIds: string[];
  relatedEntityIds?: string[];
  source?: string;
  reportType?: string;
  recommendedActions: string[];
  limitations: string[];
  confidence: number;
};

@Injectable()
export class RecommendationGeneratorService {
  constructor(
    @Optional()
    private readonly debugLogger: AiDebugLoggerService = new AiDebugLoggerService(),
  ) {}

  async generateFromContext(
    context: AiMarketingContext,
    provider: AiProvider,
    options: {
      correlationId?: string;
      importId?: string;
      rawFileId?: string;
      source?: string;
      reportType?: string;
      model?: string;
    } = {},
  ): Promise<GeneratedRecommendation[]> {
    const correlationId = this.debugLogger.ensureCorrelationId(
      options.correlationId,
    );
    const meta = {
      correlationId,
      projectId: context.projectId,
      importId: options.importId ?? context.scope.importId,
      rawFileId: options.rawFileId,
      source: options.source ?? context.scope.source,
      reportType: options.reportType ?? context.reportTypes[0],
      aiFlow: 'recommendation' as const,
      promptType: 'RECOMMENDATION' as const,
      model: options.model,
      temperature: 0.2,
      maxTokens: Number(process.env.AI_MAX_TOKENS ?? 1200),
    };
    this.debugLogger.log('RECOMMENDATION_GENERATION_STARTED', meta, {
      factsCount: context.facts.length,
      factTypes: Array.from(
        new Set(context.facts.map((fact) => fact.factType)),
      ),
    });
    if (context.facts.length === 0) return [];
    try {
      this.debugLogger.logContextBuilt(meta, context);
      const messages = [
        {
          role: 'system' as const,
          content: `${AI_DEFENSIVE_SYSTEM_PROMPT}\n${AI_OUTPUT_JSON_RULES}`,
        },
        {
          role: 'user' as const,
          content: `Generate concise structured recommendations from this bounded context only. Expected JSON schema: {\"recommendations\":[{\"title\":\"string\",\"summary\":\"string\",\"priority\":\"LOW|MEDIUM|HIGH|CRITICAL\",\"relatedFactIds\":[\"fact ids or fact types\"],\"relatedEntityIds\":[\"entity ids\"],\"source\":\"source if known\",\"reportType\":\"report type if known\",\"recommendedActions\":[\"actions\"],\"limitations\":[\"limitations and missing data\"],\"confidence\":0.0}]}. Every item must reference fact types/fact IDs and must not claim unavailable metrics.\n${JSON.stringify(context)}`,
        },
      ];
      this.debugLogger.logPromptBuilt(meta, messages);
      if (this.debugLogger.containsForbiddenRawData(messages))
        throw new Error('AI prompt contains forbidden raw data fields.');
      const response = await provider.generateJson<{
        recommendations?: AiRecommendationOutput[];
      }>({
        schemaName: 'marketing_recommendations',
        messages,
        temperature: 0.2,
        metadata: {
          ...meta,
          facts: context.facts,
          unavailableMetrics: context.unavailableMetrics,
        },
      });
      const outputs = Array.isArray(response.data.recommendations)
        ? response.data.recommendations
        : [];
      this.debugLogger.logResponseParsed(
        { ...meta, model: response.model },
        {
          outputType: 'recommendations',
          itemsCount: outputs.length,
          valid: true,
          parsedOutput: response.data,
        },
      );
      return outputs
        .filter((output) => this.isValidOutput(output))
        .map((output, index) => ({
          title: output.title,
          body: output.summary,
          summary: output.summary,
          priority: output.priority,
          factType: context.facts[index]?.factType ?? context.facts[0].factType,
          relatedFactIds: output.relatedFactIds,
          relatedEntityIds: output.relatedEntityIds,
          source: output.source,
          reportType: output.reportType,
          recommendedActions: output.recommendedActions,
          limitations: output.limitations,
          confidence: output.confidence,
          rawAiOutput: response.rawResponse ?? response.data,
        }));
    } catch (error) {
      this.debugLogger.logAiSkipped(meta, {
        reason: 'RECOMMENDATION_AI_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (process.env.AI_REQUIRED === 'true') throw error;
      return this.generateFromFacts(context.facts).map((item) => ({
        ...item,
        limitations: [
          'AI provider failed or returned invalid JSON; deterministic fallback generated from detected facts only.',
        ],
      }));
    }
  }

  private isValidOutput(
    output: Partial<AiRecommendationOutput>,
  ): output is AiRecommendationOutput {
    return Boolean(
      output?.title &&
      output?.summary &&
      output?.priority &&
      Array.isArray(output.relatedFactIds) &&
      Array.isArray(output.recommendedActions) &&
      Array.isArray(output.limitations),
    );
  }

  generateFromFacts(facts: DetectedFact[]): GeneratedRecommendation[] {
    return facts.map((fact) => ({
      title: `Action for ${fact.factType}`,
      body:
        fact.recommendationHint ||
        `Review ${fact.entityType} (${fact.entityId}) due to ${fact.factType} in selected period.`,
      summary:
        fact.recommendationHint ||
        `Review ${fact.entityType} (${fact.entityId}) due to ${fact.factType} in selected period.`,
      priority: this.mapSeverityToPriority(fact.severity),
      factType: fact.factType,
      relatedFactIds: [String(fact.factType)],
      relatedEntityIds: [fact.entityId],
      source:
        String(fact.metricsSummary?.source ?? '').toLowerCase() || undefined,
      reportType: String(fact.metricsSummary?.reportType ?? '') || undefined,
      recommendedActions: [
        fact.recommendationHint ||
          'Review this detected fact with the available structured data.',
      ],
      limitations: this.limitationsForFact(fact),
      confidence: fact.confidence,
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

  private limitationsForFact(fact: DetectedFact): string[] {
    return String(fact.factType) === 'NO_RELIABLE_COST_SOURCE'
      ? [
          'Cost-based metrics such as ROAS, CPA and CAC are unavailable because no reliable cost source was provided.',
        ]
      : [
          'Recommendation is grounded only in detected facts and bounded KPI context.',
        ];
  }
}
