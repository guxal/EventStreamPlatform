import { Injectable, Optional } from '@nestjs/common';
import type { DetectedFact } from '@metrics-platform/marketing-shared';
import { AI_DEFENSIVE_SYSTEM_PROMPT } from './ai-safety.constants';
import { AiContextBuilderService } from './context';
import { AiDebugLoggerService } from './debug';
import { AiProviderFactory } from './providers';

@Injectable()
export class AiExplainerService {
  constructor(
    private readonly contextBuilder: AiContextBuilderService,
    private readonly providerFactory: AiProviderFactory,
    @Optional()
    private readonly debugLogger: AiDebugLoggerService = new AiDebugLoggerService(),
  ) {}

  buildPromptFromFacts(projectId: string, facts: DetectedFact[]): string {
    const context = this.contextBuilder.buildContext({ projectId, facts });
    const prompt = [
      AI_DEFENSIVE_SYSTEM_PROMPT,
      `Project ID: ${projectId}`,
      'Bounded AI Context JSON:',
      JSON.stringify(context, null, 2),
    ].join('\n\n');
    this.debugLogger.logPromptBuilt(
      {
        correlationId: this.debugLogger.ensureCorrelationId(),
        projectId,
        aiFlow: 'explainer',
        promptType: 'EXPLAINER',
      },
      [{ role: 'user', content: prompt }],
    );
    return prompt;
  }

  async explainFacts(
    projectId: string,
    facts: DetectedFact[],
  ): Promise<string> {
    const provider = this.providerFactory.getProvider();
    const context = this.contextBuilder.buildContext({ projectId, facts });
    const correlationId = this.debugLogger.ensureCorrelationId();
    const meta = {
      correlationId,
      projectId,
      aiFlow: 'explainer' as const,
      promptType: 'EXPLAINER' as const,
    };
    this.debugLogger.logContextBuilt(meta, context);
    const messages = [
      { role: 'system' as const, content: AI_DEFENSIVE_SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: `Explain these facts without inventing metrics:\n${JSON.stringify(context)}`,
      },
    ];
    this.debugLogger.logPromptBuilt(meta, messages);
    if (this.debugLogger.containsForbiddenRawData(messages))
      throw new Error(
        'AI explainer prompt contains forbidden raw data fields.',
      );
    const result = await provider.generateText({
      messages,
      metadata: {
        ...meta,
        facts: context.facts,
        unavailableMetrics: context.unavailableMetrics,
      },
    });
    this.debugLogger.logResponseParsed(
      { ...meta, model: result.model },
      { outputType: 'explainer', itemsCount: 1, valid: true },
    );
    return result.content;
  }
}
