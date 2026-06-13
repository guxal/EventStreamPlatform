import { Injectable } from '@nestjs/common';
import type { ProjectCohortFunnelSummary, ProjectCohortWindowSummary, ProjectDataAvailabilitySummary } from '@metrics-platform/marketing-shared';

@Injectable()
export class AppsFlyerCohortFunnelCalculator {
  readonly windows = [0, 1, 3, 7, 30];

  calculate(row: Record<string, number>, availability: ProjectDataAvailabilitySummary): ProjectCohortFunnelSummary {
    const cohortUsers = this.num(row.cohortUsers);
    const matchedUsers = this.num(row.matchedUsers);
    const limitations: string[] = [];
    if (!availability.hasInstalls) limitations.push('Cohort funnel cannot be calculated because no installs report is available.');
    if (!availability.hasInAppEvents && !availability.hasNonOrganicInAppEvents) limitations.push('Cohort funnel is incomplete because no in-app event report is available.');
    if (cohortUsers <= 0) limitations.push('Cohort funnel cannot be calculated because no install users with supported identifiers were found.');
    const identityCoverageRate = cohortUsers > 0 ? matchedUsers / cohortUsers : 0;
    if (cohortUsers > 0 && identityCoverageRate < 0.5) limitations.push('Identity coverage is low; cohort rates should be interpreted cautiously.');
    const windows: Record<string, ProjectCohortWindowSummary> = {};
    for (const days of this.windows) {
      const prefix = `d${days}`;
      const registerUsers = this.num(row[`${prefix}RegisterUsers`]);
      const depositUsers = this.num(row[`${prefix}DepositUsers`]);
      const ftdUsers = this.num(row[`${prefix}FtdUsers`]);
      windows[`D${days}`] = {
        registerUsers, depositUsers, ftdUsers,
        installToRegisterRate: cohortUsers > 0 ? registerUsers / cohortUsers : null,
        installToDepositRate: cohortUsers > 0 ? depositUsers / cohortUsers : null,
        installToFtdRate: cohortUsers > 0 ? ftdUsers / cohortUsers : null,
        depositAmount: this.num(row[`${prefix}DepositAmount`]),
      };
    }
    return { type: 'cohort', available: limitations.length === 0, cohortUsers, matchedUsers, identityCoverageRate, windows, limitations };
  }

  private num(value: unknown): number { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
}
