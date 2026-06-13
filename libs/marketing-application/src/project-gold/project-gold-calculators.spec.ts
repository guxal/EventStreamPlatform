import { AppsFlyerCohortFunnelCalculator } from './appsflyer-cohort-funnel.calculator';
import { AppsFlyerMediaSourceQualityCalculator } from './appsflyer-media-source-quality.calculator';
import { AppsFlyerPeriodFunnelCalculator } from './appsflyer-period-funnel.calculator';
import { ProjectFactsGeneratorService } from './project-facts-generator.service';

describe('Project Gold calculators', () => {
  it('calculates period install to register/deposit/FTD rates when installs exist', () => {
    const result = new AppsFlyerPeriodFunnelCalculator().calculate({ installs: 10, installUsers: 10, registrationUsers: 5, depositUsers: 3, ftdUsers: 2, depositAmount: 100 });
    expect(result.installToRegisterRate).toBe(0.5);
    expect(result.installToDepositRate).toBe(0.3);
    expect(result.installToFtdRate).toBe(0.2);
  });

  it('refuses period install-based rates when installs are missing', () => {
    const result = new AppsFlyerPeriodFunnelCalculator().calculate({ installs: 0, registrationUsers: 5, depositUsers: 3, ftdUsers: 2 });
    expect(result.installToRegisterRate).toBeNull();
    expect(result.limitations.join(' ')).toContain('no valid installs');
  });

  it('calculates D0/D1/D3/D7/D30 cohort windows and identity coverage', () => {
    const result = new AppsFlyerCohortFunnelCalculator().calculate({ cohortUsers: 10, matchedUsers: 8, d0FtdUsers: 1, d1FtdUsers: 2, d3FtdUsers: 3, d7FtdUsers: 4, d30FtdUsers: 5 } as any, { hasInstalls: true, hasInAppEvents: true, hasNonOrganicInAppEvents: false, hasBlockedInstalls: false, hasBlockedClicks: false, hasBlockedInAppEvents: false, hasAdRevenue: false, hasUninstalls: false, hasReliableCost: false, availableReportTypes: ['installs', 'in_app_events'], missingReportTypes: [], limitations: [] });
    expect(result.available).toBe(true);
    expect(result.identityCoverageRate).toBe(0.8);
    expect(result.windows.D7.installToFtdRate).toBe(0.4);
    expect(Object.keys(result.windows)).toEqual(['D0', 'D1', 'D3', 'D7', 'D30']);
  });

  it('reports cohort incomplete when identifiers/installs are missing', () => {
    const result = new AppsFlyerCohortFunnelCalculator().calculate({ cohortUsers: 0, matchedUsers: 0 } as any, { hasInstalls: false, hasInAppEvents: true, hasNonOrganicInAppEvents: false, hasBlockedInstalls: false, hasBlockedClicks: false, hasBlockedInAppEvents: false, hasAdRevenue: false, hasUninstalls: false, hasReliableCost: false, availableReportTypes: ['in_app_events'], missingReportTypes: ['installs'], limitations: [] });
    expect(result.available).toBe(false);
    expect(result.limitations.join(' ')).toContain('no installs report');
  });

  it('ranks media sources deterministically and penalizes blocked traffic', () => {
    const result = new AppsFlyerMediaSourceQualityCalculator().calculate([
      { mediaSource: 'bad', installs: 100, ftdUsers: 1, depositUsers: 1, depositAmount: 10, blockedEvents: 100, eventVolume: 100, engagementEventVolume: 90 },
      { mediaSource: 'good', installs: 100, ftdUsers: 20, depositUsers: 30, depositAmount: 500, blockedEvents: 1, eventVolume: 100, engagementEventVolume: 5 },
    ]);
    expect(result.rows[0].mediaSource).toBe('good');
    expect(result.rows[0].rank).toBe(1);
  });

  it('generates project-scoped facts and never claims reliable cost', () => {
    const facts = new ProjectFactsGeneratorService().generate({
      projectId: '00000000-0000-0000-0000-000000000001', source: 'appsflyer', analysisRunId: '00000000-0000-0000-0000-000000000002', dateRangeStart: '2026-05-14', dateRangeEnd: '2026-05-21', generatedAt: '2026-05-22T00:00:00.000Z',
      dataAvailability: { hasInstalls: true, hasInAppEvents: true, hasNonOrganicInAppEvents: false, hasBlockedInstalls: true, hasBlockedClicks: false, hasBlockedInAppEvents: true, hasAdRevenue: false, hasUninstalls: false, hasReliableCost: false, availableReportTypes: ['installs', 'in_app_events'], missingReportTypes: [], limitations: [] },
      periodFunnel: { type: 'period', installs: 10, installUsers: 10, registrationUsers: 5, depositUsers: 3, ftdUsers: 2, depositEvents: 3, ftdEvents: 2, loginUsers: 1, engagementEvents: 1, depositAmount: 100, betPlacedAmount: 0, betSettlementAmount: 0, netBetAmountApprox: 0, installToRegisterRate: 0.5, installToDepositRate: 0.3, installToFtdRate: 0.2, identityStrategy: 'customer_user_id', limitations: [] },
      cohortFunnel: { type: 'cohort', available: true, cohortUsers: 10, matchedUsers: 8, identityCoverageRate: 0.8, windows: { D0: { registerUsers: 0, depositUsers: 0, ftdUsers: 0, installToRegisterRate: 0, installToDepositRate: 0, installToFtdRate: 0, depositAmount: 0 }, D1: { registerUsers: 0, depositUsers: 0, ftdUsers: 1, installToRegisterRate: 0, installToDepositRate: 0, installToFtdRate: 0.1, depositAmount: 0 }, D3: { registerUsers: 0, depositUsers: 0, ftdUsers: 1, installToRegisterRate: 0, installToDepositRate: 0, installToFtdRate: 0.1, depositAmount: 0 }, D7: { registerUsers: 0, depositUsers: 0, ftdUsers: 2, installToRegisterRate: 0, installToDepositRate: 0, installToFtdRate: 0.2, depositAmount: 0 }, D30: { registerUsers: 0, depositUsers: 0, ftdUsers: 2, installToRegisterRate: 0, installToDepositRate: 0, installToFtdRate: 0.2, depositAmount: 0 } }, limitations: [] },
      mediaSourceQuality: { rows: [], scoringMetadata: {}, limitations: [] }, blockedTraffic: { blockedInstalls: 0, acceptedInstalls: 10, blockedInstallRate: 0, blockedInAppEvents: 0, acceptedInAppEvents: 10, blockedEventRate: 0, blockedReasonsDistribution: [], blockedMediaSourceDistribution: [] }, kpis: { total_events: 20, total_valid_events: 20, non_empty_event_amount_rows: 1, non_empty_event_revenue_rows: 0 }, limitations: [],
    });
    expect(facts.every((fact) => fact.scopeType === 'PROJECT')).toBe(true);
    expect(facts.some((fact) => fact.factType === 'PROJECT_NO_RELIABLE_COST_SOURCE')).toBe(true);
  });
});
