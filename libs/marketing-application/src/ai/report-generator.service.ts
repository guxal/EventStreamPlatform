import { Injectable, Optional } from '@nestjs/common';
import type { DetectedFact } from '@metrics-platform/marketing-shared';
import { AI_DEFENSIVE_SYSTEM_PROMPT } from './ai-safety.constants';
import type { AiMarketingContext } from './context';
import type { AiProvider } from './providers';
import { AiDebugLoggerService } from './debug';

@Injectable()
export class ReportGeneratorService {
  constructor(
    @Optional()
    private readonly debugLogger: AiDebugLoggerService = new AiDebugLoggerService(),
  ) {}

  async generateMarkdownReportFromContext(
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
  ): Promise<{ content: string; rawAiOutput?: unknown }> {
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
      aiFlow: 'report' as const,
      promptType: 'REPORT' as const,
      model: options.model,
      temperature: 0.2,
      maxTokens: Number(process.env.AI_MAX_TOKENS ?? 1200),
    };
    try {
      this.debugLogger.log('REPORT_GENERATION_STARTED', meta, {
        factsCount: context.facts.length,
        kpisCount: Object.keys(context.kpis).length,
        limitationsCount: context.unavailableMetrics.length,
      });
      this.debugLogger.logContextBuilt(meta, context);
      const messages = [
        { role: 'system' as const, content: AI_DEFENSIVE_SYSTEM_PROMPT },
        {
          role: 'user' as const,
          content: `Write a markdown report using only this bounded AI context. Include these sections exactly: Executive summary, Data sources used, Available report types, Main KPIs, Detected issues, Recommendations, Limitations, Next actions. Explicitly state insufficient data and unavailable cost/ROAS metrics when present. Never include raw CSV.\n${JSON.stringify(context)}`,
        },
      ];
      this.debugLogger.logPromptBuilt(meta, messages);
      if (this.debugLogger.containsForbiddenRawData(messages))
        throw new Error('AI prompt contains forbidden raw data fields.');
      const result = await provider.generateText({
        messages,
        temperature: 0.2,
        metadata: {
          ...meta,
          facts: context.facts,
          unavailableMetrics: context.unavailableMetrics,
        },
      });
      this.debugLogger.logResponseParsed(
        { ...meta, model: result.model },
        { outputType: 'ai_report', itemsCount: 1, valid: true },
      );
      return { content: result.content, rawAiOutput: result.rawResponse };
    } catch (error) {
      this.debugLogger.logAiSkipped(meta, {
        reason: 'REPORT_AI_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (process.env.AI_REQUIRED === 'true') throw error;
      return { content: this.generateDeterministicMarkdownReport(context) };
    }
  }

  generateMarkdownReport(projectId: string, facts: DetectedFact[]): string {
    const sources = Array.from(
      new Set(
        facts
          .map((fact) =>
            String(fact.metricsSummary?.source ?? '').toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
    const reportTypes = Array.from(
      new Set(
        facts
          .map((fact) => String(fact.metricsSummary?.reportType ?? ''))
          .filter(Boolean),
      ),
    );
    const unavailableMetrics = facts.some(
      (fact) => String(fact.factType) === 'NO_RELIABLE_COST_SOURCE',
    )
      ? [
          {
            metric: 'roas/cpa/cac',
            reason: 'No reliable cost source was provided.',
          },
        ]
      : [];
    return this.generateDeterministicMarkdownReport({
      projectId,
      project: { id: projectId },
      scope: { source: sources[0], reportTypes },
      dataAvailability: {
        hasReliableCost: unavailableMetrics.length === 0,
        hasAppsflyer: sources.includes('appsflyer'),
      },
      limitations: unavailableMetrics.map(
        (metric) => `${metric.metric}: ${metric.reason}`,
      ),
      sources,
      reportTypes,
      facts: facts as AiMarketingContext['facts'],
      kpis: {},
      unavailableMetrics,
      warnings: [],
      dataQualityNotes: [],
      semanticEntities: [],
      semanticRelationships: [],
      contextObjects: [],
    });
  }

  private generateDeterministicMarkdownReport(
    context: AiMarketingContext,
  ): string {
    const unavailable =
      context.unavailableMetrics.length > 0
        ? `\n## Unavailable metrics\n${context.unavailableMetrics.map((metric) => `- ${metric.metric}: ${metric.reason}`).join('\n')}\n\nCost-based metrics such as ROAS, CPA and CAC are unavailable because no reliable cost source was provided.\n`
        : '';
    const facts =
      context.facts.length === 0
        ? 'No detected facts were provided. Data may be insufficient for recommendations.'
        : context.facts
            .map(
              (fact, index) =>
                `### ${index + 1}. ${fact.factType}\n- Entity: ${fact.entityType} (${fact.entityId})\n- Severity: ${fact.severity}\n- Confidence: ${fact.confidence}\n- Hint: ${fact.recommendationHint || 'No hint provided'}`,
            )
            .join('\n\n');
    return `# AI Marketing Report\n\n## Executive summary\nThis report is generated only from structured detected facts and bounded KPI/context data for project ${context.projectId}.\n\n## Source / data scope\n- Sources: ${context.sources.join(', ') || 'not specified'}\n- Report types: ${context.reportTypes.join(', ') || 'not specified'}\n\n## Facts detected\n${facts}\n${unavailable}\n## Limitations\n- No raw CSV or original files were used.\n- If facts are sparse, conclusions are directional and should be validated.\n\n## Next steps\n- Review high-priority facts.\n- Add missing cost sources before evaluating ROAS, CPA or CAC.\n`;
  }
}
