import { Injectable } from '@nestjs/common';
import type { DetectedFact } from '@metrics-platform/marketing-shared';
import { AI_DEFENSIVE_SYSTEM_PROMPT } from './ai-safety.constants';

@Injectable()
export class AiExplainerService {
  buildPromptFromFacts(projectId: string, facts: DetectedFact[]): string {
    return [
      AI_DEFENSIVE_SYSTEM_PROMPT,
      `Project ID: ${projectId}`,
      'Facts JSON:',
      JSON.stringify(facts, null, 2),
    ].join('\n\n');
  }
}
