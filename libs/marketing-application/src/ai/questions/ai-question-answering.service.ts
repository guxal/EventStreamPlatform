import { Injectable, Logger, Optional } from '@nestjs/common';
import { AI_DEFENSIVE_SYSTEM_PROMPT } from '../ai-safety.constants';
import { AiDebugLoggerService } from '../debug';
import {
  AiProviderFactory,
  AiProviderName,
  asAiProviderError,
  isTransientAiProviderError,
} from '../providers';
import {
  AiQuestionDataService,
  type AiQuestionDataInput,
} from './ai-question-data.service';
import {
  AiQuestionIntentRouter,
  type AiQuestionIntent,
} from './ai-question-intent-router.service';

export type AiQuestionRequest = AiQuestionDataInput & {
  question: string;
  provider?: string;
  model?: string;
  correlationId?: string;
};

@Injectable()
export class AiQuestionAnsweringService {
  private readonly logger = new Logger(AiQuestionAnsweringService.name);
  constructor(
    private readonly router: AiQuestionIntentRouter,
    private readonly dataService: AiQuestionDataService,
    private readonly providerFactory: AiProviderFactory,
    @Optional()
    private readonly debugLogger: AiDebugLoggerService = new AiDebugLoggerService(),
  ) {}

  async answer(input: AiQuestionRequest) {
    const started = Date.now();
    const correlationId = this.debugLogger.ensureCorrelationId(
      input.correlationId,
    );
    const meta = {
      correlationId,
      projectId: input.projectId,
      importId: input.importId,
      source: input.source,
      reportType: input.reportType,
      aiFlow: 'chat' as const,
      promptType: 'AI_CHAT' as const,
      model: input.model,
      temperature: 0.1,
      maxTokens: 700,
    };
    this.debugLogger.logChatRequestReceived(meta, input.question, {
      sourceFilter: input.source,
      reportTypeFilter: input.reportType,
    });
    const intent = this.router.route(input.question);
    const data = await this.fetchData(intent, input);
    const usedData = this.usedData(data);
    try {
      const provider = this.providerFactory.getProvider(input.provider);
      this.debugLogger.logContextBuilt(meta, data, { intent });
      const messages = [
        {
          role: 'system' as const,
          content: `${AI_DEFENSIVE_SYSTEM_PROMPT}\nAnswer questions only from the bounded JSON data. Do not ask for raw CSV, generate SQL, or claim unavailable cost metrics. If the question asks for unsupported ROAS/profitability/cost metrics, refuse with the missing cost-source explanation. If Event Revenue is empty and EVENT_AMOUNT_IN_JSON is present, explain that monetary analysis uses Event Value.amount.`,
        },
        {
          role: 'user' as const,
          content: JSON.stringify({
            question: input.question,
            intent,
            filters: {
              source: input.source,
              reportType: input.reportType,
              importId: input.importId,
              dateRange: input.dateRange,
            },
            data,
          }),
        },
      ];
      this.debugLogger.logPromptBuilt(meta, messages);
      if (this.debugLogger.containsForbiddenRawData(messages))
        throw new Error('AI chat prompt contains forbidden raw data fields.');
      const result = await provider.generateText({
        model: input.model,
        temperature: 0.1,
        maxTokens: 700,
        messages,
        metadata: meta,
      });
      this.debugLogger.logResponseParsed(
        { ...meta, model: result.model },
        { outputType: 'ai_chat_response', itemsCount: 1, valid: true },
      );
      const providerName =
        provider.name === AiProviderName.MOCK
          ? 'mock'
          : provider.name.toLowerCase();
      const generationStatus =
        provider.name === AiProviderName.MOCK ? 'MOCKED' : 'COMPLETED';
      const answer = result.content || this.fallbackAnswer(intent, data);
      this.log(input, intent, providerName, generationStatus, started);
      this.debugLogger.logChatResponseSent(
        { ...meta, model: result.model },
        {
          provider: providerName,
          generationStatus,
          answerChars: answer.length,
        },
      );
      return {
        correlationId,
        answer,
        intent,
        source: input.source,
        usedData,
        limitations: this.limitations(data),
        provider: providerName,
        model:
          provider.name === AiProviderName.MOCK ? 'mock-local' : result.model,
        generationStatus,
      };
    } catch (error) {
      const providerError = asAiProviderError(error);
      if (providerError) {
        const transient = isTransientAiProviderError(providerError);
        if (!transient && process.env.AI_REQUIRED === 'true') throw providerError;
        this.log(input, intent, 'mock', 'SKIPPED', started, providerError);
        const answer = this.fallbackAnswer(intent, data);
        this.debugLogger.logAiSkipped(meta, {
          reason: 'AI_CHAT_PROVIDER_FAILED',
          errorMessage: providerError.message,
        });
        this.debugLogger.logChatResponseSent(meta, {
          provider: 'mock',
          generationStatus: 'SKIPPED',
          answerChars: answer.length,
        });
        return {
          correlationId,
          answer,
          intent,
          source: input.source,
          usedData,
          limitations: this.limitations(data),
          provider: 'mock',
          model: 'deterministic-fallback',
          generationStatus: 'SKIPPED',
          providerError: {
            code: providerError.code,
            message: providerError.message,
            httpStatus: providerError.httpStatus,
          },
        };
      }
      throw error;
    }
  }

  private async fetchData(
    intent: AiQuestionIntent,
    input: AiQuestionDataInput,
  ) {
    if (intent === 'UNAVAILABLE_METRICS')
      return {
        unavailableMetrics: await this.dataService.getUnavailableMetrics(input),
        overview: await this.dataService.getProjectOverview(input),
      };
    if (intent === 'TOP_FACTS' || intent === 'DATA_QUALITY')
      return {
        facts: await this.dataService.getTopFacts(input),
        contextObjects: await this.dataService.getContextObjects(input),
      };
    if (intent === 'MEDIA_SOURCE_PERFORMANCE')
      return {
        entityPerformance: await this.dataService.getEntityPerformance(input),
        unavailableMetrics: await this.dataService.getUnavailableMetrics(input),
      };
    if (intent === 'CAMPAIGN_PERFORMANCE')
      return {
        campaigns: await this.dataService.getCampaignPerformance(input),
        unavailableMetrics: await this.dataService.getUnavailableMetrics(input),
      };
    if (intent === 'BLOCKED_TRAFFIC')
      return {
        blockedTraffic: await this.dataService.getBlockedTraffic(input),
      };
    if (intent === 'RECOMMENDATIONS')
      return {
        recommendations: await this.dataService.getRecommendations(input),
      };
    if (intent === 'REPORT_SUMMARY')
      return { reports: await this.dataService.getLatestReports(input) };
    if (intent === 'IMPORT_SUMMARY')
      return {
        importSummary: await this.dataService.getImportSummary(input),
        facts: await this.dataService.getTopFacts(input),
      };
    if (intent === 'EVENT_PERFORMANCE')
      return {
        eventsByName: await this.dataService.getEventsByName(input),
        facts: await this.dataService.getTopFacts(input),
        unavailableMetrics: await this.dataService.getUnavailableMetrics(input),
      };
    if (intent === 'SEMANTIC_CONTEXT')
      return {
        semanticEntities: await this.dataService.getSemanticEntities(input),
        semanticRelationships:
          await this.dataService.getSemanticRelationships(input),
        contextObjects: await this.dataService.getContextObjects(input),
      };
    return {
      overview: await this.dataService.getProjectOverview(input),
      facts: await this.dataService.getTopFacts(input),
      unavailableMetrics: await this.dataService.getUnavailableMetrics(input),
    };
  }

  private fallbackAnswer(
    intent: AiQuestionIntent,
    data: Record<string, unknown>,
  ): string {
    if (intent === 'UNAVAILABLE_METRICS')
      return `ROAS, CPA, CAC, profitability, and other cost-based metrics cannot be calculated with the current data because no reliable cost source is available. AppsFlyer event data can show event volume and monetary values from Event Value.amount, but ROAS requires cost data from Google Ads, Meta Ads, or another reliable cost source.`;
    const facts = Array.isArray((data as any).facts) ? (data as any).facts : [];
    if (
      intent === 'EVENT_PERFORMANCE' &&
      facts.some((fact: any) => fact.factType === 'EVENT_REVENUE_EMPTY')
    )
      return facts.some((fact: any) => fact.factType === 'EVENT_AMOUNT_IN_JSON')
        ? 'AppsFlyer Event Revenue is empty in the processed facts. Monetary analysis can use Event Value.amount because EVENT_AMOUNT_IN_JSON was detected, but this is not ROAS and does not include ad cost.'
        : 'AppsFlyer Event Revenue is empty in the processed facts, and no alternate Event Value.amount fact is available in the selected context. Monetary analysis is insufficient.';
    if (
      intent === 'EVENT_PERFORMANCE' &&
      facts.some((fact: any) =>
        [
          'LOW_INSTALL_TO_DEPOSIT',
          'LOW_INSTALL_TO_FTD',
          'LOW_INSTALL_TO_REGISTER',
        ].includes(fact.factType),
      )
    )
      return `The selected processed data contains funnel-quality facts: ${facts
        .filter((fact: any) =>
          [
            'LOW_INSTALL_TO_DEPOSIT',
            'LOW_INSTALL_TO_FTD',
            'LOW_INSTALL_TO_REGISTER',
          ].includes(fact.factType),
        )
        .map((fact: any) => fact.factType)
        .join(
          ', ',
        )}. Do not calculate rates unless the numerator and denominator are explicitly present in KPIs/facts.`;
    if (intent === 'TOP_FACTS')
      return facts.length
        ? `The main detected facts are: ${facts
            .slice(0, 5)
            .map((fact: any) => `${fact.factType} (${fact.severity})`)
            .join(
              ', ',
            )}. Use these facts as guidance; no raw CSV was inspected.`
        : 'No detected facts were found for the selected processed data.';
    const recommendations = Array.isArray((data as any).recommendations)
      ? (data as any).recommendations
      : [];
    if (intent === 'RECOMMENDATIONS')
      return recommendations.length
        ? `Latest recommendations: ${recommendations
            .slice(0, 3)
            .map((item: any) => item.title)
            .join('; ')}.`
        : 'No recommendations are available for the selected processed data.';
    return 'I found bounded processed data for this question, but the deterministic fallback can only summarize facts, recommendations, and unavailable metrics. No raw CSV or SQL was used.';
  }

  private usedData(data: Record<string, unknown>) {
    const count = (v: unknown) =>
      Array.isArray(v)
        ? v.length
        : v && typeof v === 'object'
          ? Object.keys(v as Record<string, unknown>).length
          : 0;
    return {
      facts: count((data as any).facts),
      kpis: count((data as any).overview),
      semanticEntities: count((data as any).semanticEntities),
      contextObjects: count((data as any).contextObjects),
    };
  }
  private limitations(data: Record<string, unknown>): string[] {
    return Array.isArray((data as any).unavailableMetrics) &&
      (data as any).unavailableMetrics.length
      ? ['Cost-based metrics are unavailable without a reliable cost source.']
      : [];
  }
  private log(
    input: AiQuestionRequest,
    intent: AiQuestionIntent,
    provider: string,
    generationStatus: string,
    started: number,
    error?: unknown,
  ): void {
    this.logger.log({
      projectId: input.projectId,
      intent,
      source: input.source,
      provider,
      generationStatus,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : undefined,
    });
  }
}
