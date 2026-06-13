import { Injectable } from '@nestjs/common';
import type { ProjectPeriodFunnelSummary } from '@metrics-platform/marketing-shared';

@Injectable()
export class AppsFlyerPeriodFunnelCalculator {
  calculate(row: Record<string, number | string>): ProjectPeriodFunnelSummary {
    const installs = this.num(row.installs);
    const installUsers = this.num(row.installUsers) || installs;
    const registrationUsers = this.num(row.registrationUsers);
    const depositUsers = this.num(row.depositUsers);
    const ftdUsers = this.num(row.ftdUsers);
    const limitations: string[] = [];
    const missingIdentityRows = this.num(row.missingIdentityRows);
    const totalValidEvents = this.num(row.totalValidEvents);
    if (installs <= 0) limitations.push('Install-based rates are unavailable because no valid installs are present in the selected project/date range.');
    if (missingIdentityRows > 0) limitations.push('Some events did not have customer_user_id or AppsFlyer ID; unique-user metrics may fall back to row-level counts for those rows.');
    const identityStrategy = this.num(row.customerIdRows) > 0 ? 'customer_user_id' : this.num(row.appsflyerIdRows) > 0 ? 'appsflyer_id' : totalValidEvents > 0 ? 'row_hash_fallback' : 'none';
    return {
      type: 'period', installs, installUsers, registrationUsers, depositUsers, ftdUsers,
      depositEvents: this.num(row.depositEvents), ftdEvents: this.num(row.ftdEvents), loginUsers: this.num(row.loginUsers), engagementEvents: this.num(row.engagementEvents),
      depositAmount: this.num(row.depositAmount), betPlacedAmount: this.num(row.betPlacedAmount), betSettlementAmount: this.num(row.betSettlementAmount), netBetAmountApprox: this.num(row.betPlacedAmount) + this.num(row.betSettlementAmount),
      installToRegisterRate: installUsers > 0 ? registrationUsers / installUsers : null,
      installToDepositRate: installUsers > 0 ? depositUsers / installUsers : null,
      installToFtdRate: installUsers > 0 ? ftdUsers / installUsers : null,
      identityStrategy, limitations,
    };
  }

  private num(value: unknown): number { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
}
