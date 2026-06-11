import { Injectable, Logger } from '@nestjs/common';
import { AI_DEFENSIVE_SYSTEM_PROMPT } from '../ai-safety.constants';
import { AiProviderError, AiProviderFactory, AiProviderName } from '../providers';
import { AiQuestionDataService, type AiQuestionDataInput } from './ai-question-data.service';
import { AiQuestionIntentRouter, type AiQuestionIntent } from './ai-question-intent-router.service';

export type AiQuestionRequest = AiQuestionDataInput & { question: string; provider?: string; model?: string };

@Injectable()
export class AiQuestionAnsweringService {
  private readonly logger = new Logger(AiQuestionAnsweringService.name);
  constructor(private readonly router: AiQuestionIntentRouter, private readonly dataService: AiQuestionDataService, private readonly providerFactory: AiProviderFactory) {}

  async answer(input: AiQuestionRequest) {
    const started = Date.now();
    const intent = this.router.route(input.question);
    const data = await this.fetchData(intent, input);
    const usedData = this.usedData(data);
    try {
      const provider = this.providerFactory.getProvider(input.provider);
      const result = await provider.generateText({ model: input.model, temperature: 0.1, maxTokens: 700, messages: [{ role: 'system', content: `${AI_DEFENSIVE_SYSTEM_PROMPT}\nAnswer questions only from the bounded JSON data. Do not ask for raw CSV, generate SQL, or claim unavailable cost metrics.` }, { role: 'user', content: JSON.stringify({ question: input.question, intent, filters: { source: input.source, reportType: input.reportType, importId: input.importId, dateRange: input.dateRange }, data }) }] });
      const providerName = provider.name === AiProviderName.MOCK ? 'mock' : provider.name.toLowerCase();
      const generationStatus = provider.name === AiProviderName.MOCK ? 'MOCKED' : 'COMPLETED';
      this.log(input, intent, providerName, generationStatus, started);
      return { answer: result.content || this.fallbackAnswer(intent, data), intent, source: input.source, usedData, limitations: this.limitations(data), provider: providerName, model: provider.name === AiProviderName.MOCK ? 'mock-local' : result.model, generationStatus };
    } catch (error) {
      if (error instanceof AiProviderError && process.env.AI_REQUIRED === 'true') throw error;
      this.log(input, intent, 'mock', 'SKIPPED', started, error);
      return { answer: this.fallbackAnswer(intent, data), intent, source: input.source, usedData, limitations: this.limitations(data), provider: 'mock', model: 'deterministic-fallback', generationStatus: 'SKIPPED' };
    }
  }

  private async fetchData(intent: AiQuestionIntent, input: AiQuestionDataInput) {
    if (intent === 'UNAVAILABLE_METRICS') return { unavailableMetrics: await this.dataService.getUnavailableMetrics(input), overview: await this.dataService.getProjectOverview(input) };
    if (intent === 'TOP_FACTS' || intent === 'DATA_QUALITY') return { facts: await this.dataService.getTopFacts(input), contextObjects: await this.dataService.getContextObjects(input) };
    if (intent === 'MEDIA_SOURCE_PERFORMANCE') return { entityPerformance: await this.dataService.getEntityPerformance(input), unavailableMetrics: await this.dataService.getUnavailableMetrics(input) };
    if (intent === 'CAMPAIGN_PERFORMANCE') return { campaigns: await this.dataService.getCampaignPerformance(input), unavailableMetrics: await this.dataService.getUnavailableMetrics(input) };
    if (intent === 'BLOCKED_TRAFFIC') return { blockedTraffic: await this.dataService.getBlockedTraffic(input) };
    if (intent === 'RECOMMENDATIONS') return { recommendations: await this.dataService.getRecommendations(input) };
    if (intent === 'REPORT_SUMMARY') return { reports: await this.dataService.getLatestReports(input) };
    if (intent === 'IMPORT_SUMMARY') return { importSummary: await this.dataService.getImportSummary(input), facts: await this.dataService.getTopFacts(input) };
    if (intent === 'EVENT_PERFORMANCE') return { eventsByName: await this.dataService.getEventsByName(input) };
    if (intent === 'SEMANTIC_CONTEXT') return { semanticEntities: await this.dataService.getSemanticEntities(input), semanticRelationships: await this.dataService.getSemanticRelationships(input), contextObjects: await this.dataService.getContextObjects(input) };
    return { overview: await this.dataService.getProjectOverview(input), facts: await this.dataService.getTopFacts(input), unavailableMetrics: await this.dataService.getUnavailableMetrics(input) };
  }

  private fallbackAnswer(intent: AiQuestionIntent, data: Record<string, unknown>): string {
    if (intent === 'UNAVAILABLE_METRICS') return `ROAS, CPA, CAC, and other cost-based metrics are unavailable because the bounded processed data does not include a reliable cost source. AppsFlyer data can describe events/conversions, but it should not be used alone to claim profitability.`;
    const facts = Array.isArray((data as any).facts) ? (data as any).facts : [];
    if (intent === 'TOP_FACTS') return facts.length ? `The main detected facts are: ${facts.slice(0, 5).map((fact: any) => `${fact.factType} (${fact.severity})`).join(', ')}. Use these facts as guidance; no raw CSV was inspected.` : 'No detected facts were found for the selected processed data.';
    const recommendations = Array.isArray((data as any).recommendations) ? (data as any).recommendations : [];
    if (intent === 'RECOMMENDATIONS') return recommendations.length ? `Latest recommendations: ${recommendations.slice(0, 3).map((item: any) => item.title).join('; ')}.` : 'No recommendations are available for the selected processed data.';
    return 'I found bounded processed data for this question, but the deterministic fallback can only summarize facts, recommendations, and unavailable metrics. No raw CSV or SQL was used.';
  }

  private usedData(data: Record<string, unknown>) { const count = (v: unknown) => Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v as Record<string, unknown>).length : 0; return { facts: count((data as any).facts), kpis: count((data as any).overview), semanticEntities: count((data as any).semanticEntities), contextObjects: count((data as any).contextObjects) }; }
  private limitations(data: Record<string, unknown>): string[] { return Array.isArray((data as any).unavailableMetrics) && (data as any).unavailableMetrics.length ? ['Cost-based metrics are unavailable without a reliable cost source.'] : []; }
  private log(input: AiQuestionRequest, intent: AiQuestionIntent, provider: string, generationStatus: string, started: number, error?: unknown): void { this.logger.log({ projectId: input.projectId, intent, source: input.source, provider, generationStatus, durationMs: Date.now() - started, error: error instanceof Error ? error.message : undefined }); }
}
