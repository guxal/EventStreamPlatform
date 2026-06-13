import { Injectable } from '@nestjs/common';
import type { ProjectMediaSourceQualityRow, ProjectMediaSourceQualitySummary } from '@metrics-platform/marketing-shared';

@Injectable()
export class AppsFlyerMediaSourceQualityCalculator {
  calculate(inputRows: Record<string, number | string>[]): ProjectMediaSourceQualitySummary {
    const maxDepositAmount = Math.max(1, ...inputRows.map((row) => this.num(row.depositAmount)));
    const rows = inputRows.map((row) => {
      const installs = this.num(row.installs);
      const eventVolume = this.num(row.eventVolume);
      const conversionEventVolume = this.num(row.conversionEventVolume);
      const engagementEventVolume = this.num(row.engagementEventVolume);
      const blockedEvents = this.num(row.blockedEvents);
      const depositAmount = this.num(row.depositAmount);
      const installToFtdRate = installs > 0 ? this.num(row.ftdUsers) / installs : null;
      const installToDepositRate = installs > 0 ? this.num(row.depositUsers) / installs : null;
      const blockedRate = blockedEvents + eventVolume > 0 ? blockedEvents / (blockedEvents + eventVolume) : null;
      const noisyEngagementRatio = eventVolume > 0 ? engagementEventVolume / eventVolume : 0;
      const score = Math.max(0, Math.min(100, 100 * ((installToFtdRate ?? 0) * 0.45 + (installToDepositRate ?? 0) * 0.25 + (depositAmount / maxDepositAmount) * 0.2 - (blockedRate ?? 0) * 0.25 - noisyEngagementRatio * 0.1)));
      return {
        mediaSource: String(row.mediaSource || 'unknown'), installs, registerUsers: this.num(row.registerUsers), depositUsers: this.num(row.depositUsers), ftdUsers: this.num(row.ftdUsers), depositAmount,
        betPlacedAmount: this.num(row.betPlacedAmount), betSettlementAmount: this.num(row.betSettlementAmount), blockedInstalls: this.num(row.blockedInstalls), blockedEvents, blockedRate,
        installToRegisterRate: installs > 0 ? this.num(row.registerUsers) / installs : null, installToDepositRate, installToFtdRate,
        eventVolume, conversionEventVolume, engagementEventVolume, score: Number(score.toFixed(4)), rank: 0,
        reasons: this.reasons(installToFtdRate, installToDepositRate, blockedRate, noisyEngagementRatio), limitations: installs > 0 ? [] : ['No valid installs for this media source; install-based rates are unavailable.'],
      } satisfies ProjectMediaSourceQualityRow;
    }).sort((a, b) => b.score - a.score).map((row, index) => ({ ...row, rank: index + 1 }));
    return { rows, scoringMetadata: { formula: '100 * (0.45*ftd_rate + 0.25*deposit_rate + 0.20*normalized_deposit_amount - 0.25*blocked_rate - 0.10*engagement_ratio)', profitability: 'Cost is not included; this is a quality score, not ROAS/profitability.' }, limitations: ['AppsFlyer-only media source quality does not include advertising cost, CPA, CAC, or ROAS.'] };
  }

  private reasons(ftdRate: number | null, depositRate: number | null, blockedRate: number | null, noisyRatio: number): string[] {
    const reasons: string[] = [];
    if ((ftdRate ?? 0) > 0) reasons.push('Has first-deposit conversion signal.');
    if ((depositRate ?? 0) > 0) reasons.push('Has deposit conversion signal.');
    if ((blockedRate ?? 0) > 0.2) reasons.push('Blocked traffic rate penalized the score.');
    if (noisyRatio > 0.7) reasons.push('Engagement-heavy event mix penalized the score.');
    if (reasons.length === 0) reasons.push('No strong quality signal found in AppsFlyer project data.');
    return reasons;
  }

  private num(value: unknown): number { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
}
