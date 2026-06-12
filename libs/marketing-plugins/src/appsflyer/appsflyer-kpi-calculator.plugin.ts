import { Injectable } from '@nestjs/common';
import { CanonicalEventType, ReportType, type NormalizedAppsFlyerEvent } from '@metrics-platform/marketing-shared';
import type { AppsFlyerKpiResult } from './appsflyer.types';

@Injectable()
export class AppsFlyerKpiCalculatorPlugin {
  calculate(events: NormalizedAppsFlyerEvent[], totalRowsProcessed = events.length): AppsFlyerKpiResult {
    const userIds = new Set<string>();
    const appsFlyerIds = new Set<string>();
    const customerUserIds = new Set<string>();
    let blockedEventsCount = 0;
    let eventAmountInJsonCount = 0;
    let eventRevenueEmptyCount = 0;
    let eventRevenuePresentCount = 0;
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    const result: AppsFlyerKpiResult = {
      totalRowsProcessed,
      totalNormalizedEvents: events.length,
      periodStart: null,
      periodEnd: null,
      eventsByReportType: {},
      eventsByEventName: {},
      eventsByCanonicalEventName: {},
      uniqueUsers: 0,
      uniqueAppsFlyerIds: 0,
      uniqueCustomerUserIds: 0,
      eventsByMediaSource: {},
      eventsByCampaign: {},
      eventsByCountry: {},
      eventsByPlatform: {},
      blockedEventsCount: 0,
      blockedEventsRate: null,
      blockedClicks: 0,
      blockedInAppEvents: 0,
      blockedReasons: {},
      rejectedReasons: {},
      installsCount: 0,
      installsByMediaSource: {},
      installsByCampaign: {},
      installsByCountry: {},
      installsByPlatform: {},
      blockedInstalls: 0,
      blockedInstallRate: null,
      registrations: 0,
      deposits: 0,
      firstDeposits: 0,
      depositAmount: 0,
      betPlacedAmount: 0,
      betSettlementAmount: 0,
      approximateNetBetAmount: 0,
      loginEvents: 0,
      engagementEvents: 0,
      eventAmountInJsonCount: 0,
      eventRevenueEmptyCount: 0,
      eventRevenuePresentCount: 0,
      hasReliableCostSource: false,
      unavailableMetrics: [
        { metric: 'roas', reason: 'AppsFlyer-only data has no reliable cost source.' },
        { metric: 'cpa', reason: 'AppsFlyer-only data has no reliable cost source.' },
        { metric: 'install_to_deposit_rate', reason: 'Requires comparable install and event data for the same period.' },
        { metric: 'install_to_ftd_rate', reason: 'Requires comparable install and first-deposit event data for the same period.' },
      ],
    };

    for (const event of events) {
      if (event.eventDate) {
        if (periodStart === null || event.eventDate < periodStart) {
          periodStart = event.eventDate;
        }
        if (periodEnd === null || event.eventDate > periodEnd) {
          periodEnd = event.eventDate;
        }
      }
      this.increment(result.eventsByReportType, String(event.reportType));
      this.increment(result.eventsByEventName, event.eventName || 'unknown');
      this.increment(result.eventsByCanonicalEventName, event.canonicalEventName);
      this.increment(result.eventsByMediaSource, event.mediaSource || 'unknown');
      this.increment(result.eventsByCampaign, event.campaignName || event.campaignId || 'unknown');
      this.increment(result.eventsByCountry, event.countryCode || 'unknown');
      this.increment(result.eventsByPlatform, event.platform || 'unknown');

      if (event.appsflyerId) { appsFlyerIds.add(event.appsflyerId); userIds.add(`af:${event.appsflyerId}`); }
      if (event.customerUserId) { customerUserIds.add(event.customerUserId); userIds.add(`cu:${event.customerUserId}`); }
      if (event.isBlocked) {
        blockedEventsCount += 1;
        if (event.blockedReason) this.increment(result.blockedReasons, event.blockedReason);
        if (event.rejectedReason) this.increment(result.rejectedReasons, event.rejectedReason);
      }
      if (event.reportType === ReportType.BLOCKED_CLICKS) result.blockedClicks += 1;
      if (event.reportType === ReportType.BLOCKED_IN_APP_EVENTS) result.blockedInAppEvents += 1;
      if (event.eventAmount !== null && event.eventAmount !== undefined) eventAmountInJsonCount += 1;
      if (event.eventRevenue === null || event.eventRevenue === undefined) eventRevenueEmptyCount += 1; else eventRevenuePresentCount += 1;

      if (event.canonicalEventName === CanonicalEventType.INSTALL) {
        result.installsCount += 1;
        this.increment(result.installsByMediaSource, event.mediaSource || 'unknown');
        this.increment(result.installsByCampaign, event.campaignName || event.campaignId || 'unknown');
        this.increment(result.installsByCountry, event.countryCode || 'unknown');
        this.increment(result.installsByPlatform, event.platform || 'unknown');
        if (event.isBlocked || event.reportType === ReportType.BLOCKED_INSTALLS) result.blockedInstalls += 1;
      }

      switch (event.canonicalEventName) {
        case CanonicalEventType.REGISTRATION:
          result.registrations += 1;
          break;
        case CanonicalEventType.DEPOSIT:
          result.deposits += 1;
          result.depositAmount += event.eventAmount ?? event.eventRevenue ?? 0;
          break;
        case CanonicalEventType.FIRST_DEPOSIT:
          result.firstDeposits += 1;
          result.depositAmount += event.eventAmount ?? event.eventRevenue ?? 0;
          break;
        case CanonicalEventType.BET_PLACED:
          result.betPlacedAmount += event.eventAmount ?? 0;
          break;
        case CanonicalEventType.BET_SETTLEMENT:
          result.betSettlementAmount += event.eventAmount ?? 0;
          break;
        case CanonicalEventType.LOGIN:
          result.loginEvents += 1;
          break;
        case CanonicalEventType.ENGAGEMENT:
          result.engagementEvents += 1;
          break;
        default:
          break;
      }
    }

    result.periodStart = periodStart;
    result.periodEnd = periodEnd;
    result.uniqueUsers = userIds.size;
    result.uniqueAppsFlyerIds = appsFlyerIds.size;
    result.uniqueCustomerUserIds = customerUserIds.size;
    result.blockedEventsCount = blockedEventsCount;
    result.blockedEventsRate = events.length > 0 ? blockedEventsCount / events.length : null;
    result.blockedInstallRate = result.installsCount > 0 ? result.blockedInstalls / result.installsCount : null;
    result.eventAmountInJsonCount = eventAmountInJsonCount;
    result.eventRevenueEmptyCount = eventRevenueEmptyCount;
    result.eventRevenuePresentCount = eventRevenuePresentCount;
    result.approximateNetBetAmount = result.betSettlementAmount - result.betPlacedAmount;
    return result;
  }

  private increment(target: Record<string, number>, key: string): void {
    target[key] = (target[key] ?? 0) + 1;
  }
}
