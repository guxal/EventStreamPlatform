import { Readable } from 'stream';
import { AppsFlyerColumnMapper } from './appsflyer-column-mapper';
import { AppsFlyerCsvStreamParserPlugin } from './appsflyer-csv-stream-parser.plugin';
import { AppsFlyerEventValueParserPlugin } from './appsflyer-event-value-parser.plugin';
import { AppsFlyerFactsPlugin } from './appsflyer-facts.plugin';
import { AppsFlyerKpiCalculatorPlugin } from './appsflyer-kpi-calculator.plugin';
import { AppsFlyerNormalizerPlugin } from './appsflyer-normalizer.plugin';
import { AppsFlyerReportProfilerPlugin } from './appsflyer-report-profiler.plugin';
import { CanonicalEventType, DataSource, FactType, ReportType } from '@metrics-platform/marketing-shared';

const context = { projectId: 'project-1', importId: 'import-1', rawFileId: 'file-1', source: DataSource.APPSFLYER, reportType: ReportType.NON_ORGANIC_IN_APP_EVENTS };

describe('AppsFlyer processing plugins', () => {
  it('parser reads stream rows and mapper normalizes AppsFlyer headers', async () => {
    const parser = new AppsFlyerCsvStreamParserPlugin();
    const mapper = new AppsFlyerColumnMapper();
    const rows = [];
    for await (const row of parser.parse(Readable.from(['AppsFlyer ID,Event Name,Event Value\naf-1,deposit_success,"{""amount"":12.5}"\n']))) rows.push(row);
    expect(rows).toHaveLength(1);
    expect(mapper.map(rows[0]).canonical.appsflyerId).toBe('af-1');
    expect(mapper.map(rows[0]).canonical.eventName).toBe('deposit_success');
  });

  it('event value parser extracts Event Value.amount without crashing import', async () => {
    const parser = new AppsFlyerEventValueParserPlugin();
    const parsed = parser.parse({ rowNumber: 1, raw: {}, warnings: [], canonical: { eventValue: '{"amount":42}' } });
    expect(parsed.eventAmount).toBe(42);
    expect(parsed.eventValueJson).toEqual({ amount: 42 });
    const malformed = parser.parse({ rowNumber: 2, raw: {}, warnings: [], canonical: { eventValue: '{bad' } });
    expect(malformed.warnings[0]).toContain('event_value_parse_failed');
  });

  it('normalizer creates marketing_events-compatible rows', () => {
    const event = new AppsFlyerNormalizerPlugin().normalize(context, { rowNumber: 1, warnings: [], raw: { Event: 'x' }, canonical: { eventName: 'first_deposit_success', eventTime: '2026-06-01T00:00:00Z', mediaSource: 'net', campaignName: 'camp' }, eventAmount: 10, eventValueJson: { amount: 10 } });
    expect(event.rawFileId).toBe('file-1');
    expect(event.source).toBe(DataSource.APPSFLYER);
    expect(event.reportType).toBe(ReportType.NON_ORGANIC_IN_APP_EVENTS);
    expect(event.canonicalEventName).toBe(CanonicalEventType.FIRST_DEPOSIT);
    expect(event.rowHash).toBeTruthy();
  });

  it('KPI calculator returns event counts and does not calculate ROAS or install-to-deposit without cost/install source', () => {
    const normalizer = new AppsFlyerNormalizerPlugin();
    const events = [
      normalizer.normalize(context, { rowNumber: 1, warnings: [], raw: {}, canonical: { eventName: 'deposit_success', eventTime: '2026-06-01', appsflyerId: 'af-1' }, eventAmount: 10, eventValueJson: { amount: 10 } }),
      normalizer.normalize(context, { rowNumber: 2, warnings: [], raw: {}, canonical: { eventName: 'first_deposit_success', eventTime: '2026-06-01', customerUserId: 'cu-1' }, eventAmount: 20, eventValueJson: { amount: 20 } }),
      normalizer.normalize(context, { rowNumber: 3, warnings: [], raw: {}, canonical: { eventName: 'casino_bet_placed', eventTime: '2026-06-01' }, eventAmount: 5, eventValueJson: { amount: 5 } }),
      normalizer.normalize(context, { rowNumber: 4, warnings: [], raw: {}, canonical: { eventName: 'casino_bet_settlement_success', eventTime: '2026-06-01' }, eventAmount: 8, eventValueJson: { amount: 8 } }),
    ];
    const kpis = new AppsFlyerKpiCalculatorPlugin().calculate(events);
    expect(kpis.deposits).toBe(1);
    expect(kpis.firstDeposits).toBe(1);
    expect(kpis.depositAmount).toBe(30);
    expect(kpis.betPlacedAmount).toBe(5);
    expect(kpis.betSettlementAmount).toBe(8);
    expect('roas' in kpis).toBe(false);
    expect('installToDepositRate' in kpis).toBe(false);
  });

  it('facts plugin generates AppsFlyer defensive facts', () => {
    const facts = new AppsFlyerFactsPlugin().generate(context, { reportType: ReportType.NON_ORGANIC_IN_APP_EVENTS, headers: [], rowCount: 10, sampleRows: [], isEmpty: false, exportLimitReached: false, classificationConfidence: 1, preparedFacts: [] }, { ...new AppsFlyerKpiCalculatorPlugin().calculate([]), totalNormalizedEvents: 10, eventRevenueEmptyCount: 10, eventAmountInJsonCount: 3 });
    expect(facts.map((fact) => fact.factType)).toEqual(expect.arrayContaining([FactType.NO_RELIABLE_COST_SOURCE, FactType.EVENT_AMOUNT_IN_JSON, FactType.EVENT_REVENUE_EMPTY]));
  });

  it('profiler prepares EMPTY_REPORT and DATA_EXPORT_LIMIT_REACHED facts', async () => {
    const profiler = new AppsFlyerReportProfilerPlugin();
    const empty = await profiler.profile({ context, existingProfile: { rowCount: 0, headers: ['A'], sampleRows: [], classificationConfidence: 1 } as never });
    const limited = await profiler.profile({ context, existingProfile: { rowCount: 200000, headers: ['A'], sampleRows: [], classificationConfidence: 1 } as never });
    expect(empty.preparedFacts[0].factType).toBe(FactType.EMPTY_REPORT);
    expect(limited.preparedFacts[0].factType).toBe(FactType.DATA_EXPORT_LIMIT_REACHED);
  });
});
