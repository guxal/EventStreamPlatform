import { Injectable } from '@nestjs/common';
import type { DetectedFact } from '@metrics-platform/marketing-shared';

@Injectable()
export class ReportGeneratorService {
  generateMarkdownReport(projectId: string, facts: DetectedFact[]): string {
    const header = `# AI Marketing Report\n\nProject: ${projectId}\n\n`;
    const intro =
      facts.length === 0
        ? 'No detected facts were provided. Data may be insufficient for recommendations.\n\n'
        : `Detected facts: ${facts.length}\n\n`;

    const sections = facts
      .map(
        (fact, index) =>
          `## ${index + 1}. ${fact.factType}\n- Entity: ${fact.entityType} (${fact.entityId})\n- Severity: ${fact.severity}\n- Confidence: ${fact.confidence}\n- Hint: ${fact.recommendationHint || 'No hint provided'}\n`,
      )
      .join('\n');

    return `${header}${intro}${sections}`;
  }
}
