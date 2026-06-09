import { Injectable } from '@nestjs/common';
import type { DetectedFact } from '@metrics-platform/marketing-shared';
import { AI_DEFENSIVE_SYSTEM_PROMPT } from './ai-safety.constants';
import { AiContextBuilderService } from './context';
import { AiProviderFactory } from './providers';

@Injectable()
export class AiExplainerService {
  constructor(
    private readonly contextBuilder: AiContextBuilderService,
    private readonly providerFactory: AiProviderFactory,
  ) {}

  buildPromptFromFacts(projectId: string, facts: DetectedFact[]): string {
    const context = this.contextBuilder.buildContext({ projectId, facts });
    return [AI_DEFENSIVE_SYSTEM_PROMPT, `Project ID: ${projectId}`, 'Bounded AI Context JSON:', JSON.stringify(context, null, 2)].join('\n\n');
  }

  async explainFacts(projectId: string, facts: DetectedFact[]): Promise<string> {
    const provider = this.providerFactory.getProvider();
    const context = this.contextBuilder.buildContext({ projectId, facts });
    const result = await provider.generateText({
      messages: [
        { role: 'system', content: AI_DEFENSIVE_SYSTEM_PROMPT },
        { role: 'user', content: `Explain these facts without inventing metrics:\n${JSON.stringify(context)}` },
      ],
      metadata: { facts: context.facts, unavailableMetrics: context.unavailableMetrics },
    });
    return result.content;
  }
}
