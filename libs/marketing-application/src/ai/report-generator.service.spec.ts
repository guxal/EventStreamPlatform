import { EntityType, FactType, Severity } from '@metrics-platform/marketing-shared';
import { AiContextBuilderService } from './context';
import { MockAiProvider } from './providers';
import { ReportGeneratorService } from './report-generator.service';
import { AI_DEFENSIVE_SYSTEM_PROMPT } from './ai-safety.constants';

describe('ReportGeneratorService', () => {
  it('states unavailable metrics clearly', async () => {
    const context = new AiContextBuilderService().buildContext({
      projectId: 'project-1',
      facts: [{ entityId: 'project-1', entityType: EntityType.ACCOUNT, factType: FactType.NO_RELIABLE_COST_SOURCE, severity: Severity.INFO, confidence: 0.99, temporalContext: { lookbackDays: 0, startDate: 'x', endDate: 'x' }, metricsSummary: { source: 'APPSFLYER' } }],
    });
    const report = await new ReportGeneratorService().generateMarkdownReportFromContext(context, new MockAiProvider());
    expect(report.content).toContain('ROAS');
  });
});


it('defensive system prompt forbids unsupported ROAS and raw CSV analysis', () => {
  expect(AI_DEFENSIVE_SYSTEM_PROMPT).toContain('Never read');
  expect(AI_DEFENSIVE_SYSTEM_PROMPT).toContain('ROAS');
  expect(AI_DEFENSIVE_SYSTEM_PROMPT).toContain('EVENT_AMOUNT_IN_JSON');
});
