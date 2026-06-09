import { Injectable } from '@nestjs/common';
import type { DetectedFact } from '@metrics-platform/marketing-shared';
import { AI_DEFENSIVE_SYSTEM_PROMPT } from './ai-safety.constants';
import type { AiMarketingContext } from './context';
import type { AiProvider } from './providers';

@Injectable()
export class ReportGeneratorService {
  async generateMarkdownReportFromContext(context: AiMarketingContext, provider: AiProvider): Promise<{ content: string; rawAiOutput?: unknown }> {
    try {
      const result = await provider.generateText({
        messages: [
          { role: 'system', content: AI_DEFENSIVE_SYSTEM_PROMPT },
          { role: 'user', content: `Write a markdown report using only this bounded AI context:\n${JSON.stringify(context)}` },
        ],
        temperature: 0.2,
        metadata: { facts: context.facts, unavailableMetrics: context.unavailableMetrics },
      });
      return { content: result.content, rawAiOutput: result.rawResponse };
    } catch (error) {
      if (process.env.AI_REQUIRED === 'true') throw error;
      return { content: this.generateDeterministicMarkdownReport(context) };
    }
  }

  generateMarkdownReport(projectId: string, facts: DetectedFact[]): string {
    return this.generateDeterministicMarkdownReport({
      projectId,
      sources: Array.from(new Set(facts.map((fact) => String(fact.metricsSummary?.source ?? '').toLowerCase()).filter(Boolean))),
      reportTypes: Array.from(new Set(facts.map((fact) => String(fact.metricsSummary?.reportType ?? '')).filter(Boolean))),
      facts: facts as AiMarketingContext['facts'],
      kpis: {},
      unavailableMetrics: facts.some((fact) => fact.factType === 'NO_RELIABLE_COST_SOURCE')
        ? [{ metric: 'roas/cpa/cac', reason: 'No reliable cost source was provided.' }]
        : [],
      warnings: [],
      dataQualityNotes: [],
      semanticEntities: [],
      semanticRelationships: [],
      contextObjects: [],
    });
  }

  private generateDeterministicMarkdownReport(context: AiMarketingContext): string {
    const unavailable = context.unavailableMetrics.length > 0
      ? `\n## Unavailable metrics\n${context.unavailableMetrics.map((metric) => `- ${metric.metric}: ${metric.reason}`).join('\n')}\n\nCost-based metrics such as ROAS, CPA and CAC are unavailable because no reliable cost source was provided.\n`
      : '';
    const facts = context.facts.length === 0
      ? 'No detected facts were provided. Data may be insufficient for recommendations.'
      : context.facts.map((fact, index) => `### ${index + 1}. ${fact.factType}\n- Entity: ${fact.entityType} (${fact.entityId})\n- Severity: ${fact.severity}\n- Confidence: ${fact.confidence}\n- Hint: ${fact.recommendationHint || 'No hint provided'}`).join('\n\n');
    return `# AI Marketing Report\n\n## Executive summary\nThis report is generated only from structured detected facts and bounded KPI/context data for project ${context.projectId}.\n\n## Source / data scope\n- Sources: ${context.sources.join(', ') || 'not specified'}\n- Report types: ${context.reportTypes.join(', ') || 'not specified'}\n\n## Facts detected\n${facts}\n${unavailable}\n## Limitations\n- No raw CSV or original files were used.\n- If facts are sparse, conclusions are directional and should be validated.\n\n## Next steps\n- Review high-priority facts.\n- Add missing cost sources before evaluating ROAS, CPA or CAC.\n`;
  }
}
