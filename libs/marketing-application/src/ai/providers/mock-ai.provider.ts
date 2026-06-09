import { AiProviderName, type AiGenerateJsonInput, type AiGenerateJsonResult, type AiGenerateTextInput, type AiGenerateTextResult, type AiProvider } from './ai-provider.types';

export class MockAiProvider implements AiProvider {
  readonly name = AiProviderName.MOCK;
  private readonly model = process.env.AI_MODEL || 'mock-marketing-model-v1';

  isConfigured(): boolean { return true; }

  async generateText(input: AiGenerateTextInput): Promise<AiGenerateTextResult> {
    const facts = this.factCount(input.metadata);
    return {
      provider: this.name,
      model: input.model || this.model,
      content: `Mock AI response grounded in ${facts} detected fact(s). Cost-based metrics such as ROAS, CPA and CAC are unavailable when no reliable cost source was provided.`,
      finishReason: 'stop',
    };
  }

  async generateJson<T = unknown>(input: AiGenerateJsonInput): Promise<AiGenerateJsonResult<T>> {
    const data = this.buildSchemaData(input.schemaName, input.metadata) as T;
    return {
      provider: this.name,
      model: input.model || this.model,
      data,
      rawContent: JSON.stringify(data),
    };
  }

  private buildSchemaData(schemaName: string | undefined, metadata: Record<string, unknown> | undefined): unknown {
    if (schemaName === 'marketing_recommendations') {
      const facts = Array.isArray(metadata?.facts) ? metadata.facts as Array<Record<string, unknown>> : [];
      return {
        recommendations: facts.map((fact, index) => ({
          title: `Mock recommendation for ${String(fact.factType ?? 'detected fact')}`,
          summary: String(fact.recommendationHint ?? 'Review this detected fact before taking action.'),
          priority: this.priorityFromSeverity(String(fact.severity ?? 'INFO')),
          relatedFactIds: [String(fact.id ?? fact.factType ?? `fact_${index}`)],
          relatedEntityIds: fact.entityId ? [String(fact.entityId)] : [],
          source: fact.source,
          reportType: fact.reportType,
          recommendedActions: [String(fact.recommendationHint ?? 'Investigate the detected fact with the available structured data.')],
          limitations: ['Mock provider used; verify with production AI provider before stakeholder delivery.'],
          confidence: Number(fact.confidence ?? 0.7),
        })),
      };
    }
    return { ok: true, schemaName: schemaName ?? 'unknown' };
  }

  private priorityFromSeverity(severity: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (severity === 'CRITICAL') return 'CRITICAL';
    if (severity === 'WARNING') return 'HIGH';
    if (severity === 'INFO') return 'MEDIUM';
    return 'LOW';
  }

  private factCount(metadata: Record<string, unknown> | undefined): number {
    return Array.isArray(metadata?.facts) ? metadata.facts.length : 0;
  }
}
