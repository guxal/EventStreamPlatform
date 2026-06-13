import { Injectable } from '@nestjs/common';
import { CanonicalEventType, ReportType } from '@metrics-platform/marketing-shared';
import { ClickHouseQueryClient } from './clickhouse-query.util';

export type AppsFlyerEventFilters = {
  from?: string;
  to?: string;
  importId?: string;
  reportType?: string;
  mediaSource?: string;
  campaignName?: string;
  canonicalEventName?: string;
  trafficScope?: 'valid' | 'blocked' | 'all';
  limit?: number;
};

@Injectable()
export class AppsFlyerEventsRepository {
  private readonly client = new ClickHouseQueryClient();

  async getOverview(projectId: string) {
    const rows = await this.client.query<Record<string, unknown>>(
      `SELECT
        count() AS totalRawEvents,
        countIf(is_blocked = 0) AS totalValidEvents,
        countIf(is_blocked = 1) AS totalBlockedEvents,
        if(count() = 0, NULL, countIf(is_blocked = 1) / count()) AS blockedRate,
        if(count() = 0, NULL, countIf(is_blocked = 0) / count()) AS validEventRate,
        uniqExact(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''))) AS uniqueUsers,
        countIf(canonical_event_name = '${CanonicalEventType.REGISTRATION}') AS registrations,
        countIf(canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS deposits,
        countIf(canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS firstDeposits,
        sumIf(toFloat64(ifNull(event_amount, 0)), canonical_event_name IN ('${CanonicalEventType.DEPOSIT}', '${CanonicalEventType.FIRST_DEPOSIT}')) AS depositAmount,
        sumIf(toFloat64(ifNull(event_amount, 0)), canonical_event_name = '${CanonicalEventType.BET_PLACED}') AS betPlacedAmount,
        sumIf(toFloat64(ifNull(event_amount, 0)), canonical_event_name = '${CanonicalEventType.BET_SETTLEMENT}') AS betSettlementAmount,
        countIf(is_blocked = 1) AS blockedEvents,
        countIf(report_type = '${ReportType.BLOCKED_INSTALLS}') AS blockedInstalls,
        countIf(report_type = '${ReportType.BLOCKED_CLICKS}') AS blockedClicks,
        countIf(report_type = '${ReportType.BLOCKED_IN_APP_EVENTS}') AS blockedInAppEvents,
        countIf(canonical_event_name = '${CanonicalEventType.LOGIN}') AS loginEvents,
        countIf(canonical_event_name = '${CanonicalEventType.ENGAGEMENT}') AS engagementEvents
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER'`,
    );
    const row: Record<string, unknown> = rows[0] ?? {};
    const betPlacedAmount = this.num(row.betPlacedAmount);
    const betSettlementAmount = this.num(row.betSettlementAmount);
    return {
      totalEvents: this.num(row.totalRawEvents),
      totalRawEvents: this.num(row.totalRawEvents),
      totalValidEvents: this.num(row.totalValidEvents),
      totalBlockedEvents: this.num(row.totalBlockedEvents),
      uniqueUsers: this.num(row.uniqueUsers),
      registrations: this.num(row.registrations),
      deposits: this.num(row.deposits),
      firstDeposits: this.num(row.firstDeposits),
      depositAmount: this.num(row.depositAmount),
      betPlacedAmount,
      betSettlementAmount,
      approximateNetBetAmount: betSettlementAmount - betPlacedAmount,
      blockedEvents: this.num(row.blockedEvents),
      validEvents: this.num(row.totalValidEvents),
      isBlockedIncluded: true,
      blockedRate: row.blockedRate === null || row.blockedRate === undefined ? null : this.num(row.blockedRate),
      blockedInstalls: this.num(row.blockedInstalls),
      blockedClicks: this.num(row.blockedClicks),
      blockedInAppEvents: this.num(row.blockedInAppEvents),
      loginEvents: this.num(row.loginEvents),
      engagementEvents: this.num(row.engagementEvents),
      unavailableMetrics: [
        { metric: 'roas', reason: 'AppsFlyer-only data has no reliable cost source.' },
        { metric: 'cpa', reason: 'AppsFlyer-only data has no reliable cost source.' },
        { metric: 'install_to_deposit_rate', reason: 'Requires comparable install and event data for the same period.' },
        { metric: 'install_to_ftd_rate', reason: 'Requires comparable install and first-deposit event data for the same period.' },
      ],
      warnings: this.num(row.totalRawEvents) > 0 ? [] : ['No AppsFlyer events found for this project.'],
    };
  }

  async getEventsByName(projectId: string, filters: AppsFlyerEventFilters = {}) {
    return this.client.query(
      `SELECT
        event_name AS eventName,
        canonical_event_name AS canonicalEventName,
        count() AS count,
        countIf(is_blocked = 0) AS validEvents,
        countIf(is_blocked = 1) AS blockedEvents,
        if(count() = 0, NULL, countIf(is_blocked = 1) / count()) AS blockedRate,
        ${filters.trafficScope === 'all' ? '1' : '0'} AS isBlockedIncluded,
        uniqExact(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''))) AS uniqueUsers,
        sum(toFloat64(ifNull(event_amount, 0))) AS totalAmount,
        sum(toFloat64(ifNull(event_revenue, 0))) AS totalRevenue
       FROM marketing.marketing_events FINAL
       WHERE ${this.where(projectId, filters)}
       GROUP BY event_name, canonical_event_name
       ORDER BY count DESC`,
    );
  }

  async getMediaSources(projectId: string, filters: AppsFlyerEventFilters = {}) {
    return this.client.query(
      `SELECT
        coalesce(media_source, 'unknown') AS mediaSource,
        count() AS events,
        countIf(is_blocked = 0) AS validEvents,
        countIf(is_blocked = 1) AS blockedEvents,
        if(count() = 0, NULL, countIf(is_blocked = 1) / count()) AS blockedRate,
        ${filters.trafficScope === 'all' ? '1' : '0'} AS isBlockedIncluded,
        uniqExact(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''))) AS uniqueUsers,
        countIf(canonical_event_name = '${CanonicalEventType.REGISTRATION}') AS registrations,
        countIf(canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS deposits,
        countIf(canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS firstDeposits,
        sumIf(toFloat64(ifNull(event_amount, 0)), canonical_event_name IN ('${CanonicalEventType.DEPOSIT}', '${CanonicalEventType.FIRST_DEPOSIT}')) AS depositAmount
       FROM marketing.marketing_events FINAL
       WHERE ${this.where(projectId, filters)}
       GROUP BY media_source
       ORDER BY events DESC`,
    );
  }

  async getCampaigns(projectId: string, filters: AppsFlyerEventFilters = {}) {
    return this.client.query(
      `SELECT
        coalesce(campaign_name, 'unknown') AS campaignName,
        campaign_id AS campaignId,
        coalesce(media_source, 'unknown') AS mediaSource,
        count() AS events,
        countIf(is_blocked = 0) AS validEvents,
        countIf(is_blocked = 1) AS blockedEvents,
        if(count() = 0, NULL, countIf(is_blocked = 1) / count()) AS blockedRate,
        ${filters.trafficScope === 'all' ? '1' : '0'} AS isBlockedIncluded,
        uniqExact(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''))) AS uniqueUsers,
        countIf(canonical_event_name = '${CanonicalEventType.REGISTRATION}') AS registrations,
        countIf(canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS deposits,
        countIf(canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS firstDeposits,
        sumIf(toFloat64(ifNull(event_amount, 0)), canonical_event_name IN ('${CanonicalEventType.DEPOSIT}', '${CanonicalEventType.FIRST_DEPOSIT}')) AS depositAmount
       FROM marketing.marketing_events FINAL
       WHERE ${this.where(projectId, filters)}
       GROUP BY campaign_name, campaign_id, media_source
       ORDER BY events DESC`,
    );
  }

  async getBlockedTraffic(projectId: string) {
    const totals = await this.client.query<Record<string, unknown>>(
      `SELECT
        countIf(report_type = '${ReportType.BLOCKED_INSTALLS}') AS blockedInstalls,
        countIf(report_type = '${ReportType.BLOCKED_CLICKS}') AS blockedClicks,
        countIf(report_type = '${ReportType.BLOCKED_IN_APP_EVENTS}') AS blockedInAppEvents
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER'`,
    );
    const blockedReasons = await this.client.query(
      `SELECT coalesce(blocked_reason, 'unknown') AS reason, count() AS count
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER' AND is_blocked = 1
       GROUP BY blocked_reason ORDER BY count DESC`,
    );
    const rejectedReasons = await this.client.query(
      `SELECT coalesce(rejected_reason, 'unknown') AS reason, count() AS count
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER' AND is_blocked = 1
       GROUP BY rejected_reason ORDER BY count DESC`,
    );
    const blockedByMediaSource = await this.client.query(
      `SELECT coalesce(media_source, 'unknown') AS mediaSource, count() AS blockedEvents
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER' AND is_blocked = 1
       GROUP BY media_source ORDER BY blockedEvents DESC`,
    );
    const blockedByCampaign = await this.client.query(
      `SELECT coalesce(campaign_name, 'unknown') AS campaignName, campaign_id AS campaignId, count() AS blockedEvents
       FROM marketing.marketing_events FINAL
       WHERE project_id = ${this.client.escape(projectId)} AND source = 'APPSFLYER' AND is_blocked = 1
       GROUP BY campaign_name, campaign_id ORDER BY blockedEvents DESC`,
    );
    const row: Record<string, unknown> = totals[0] ?? {};
    return {
      blockedInstalls: this.num(row.blockedInstalls),
      blockedClicks: this.num(row.blockedClicks),
      blockedInAppEvents: this.num(row.blockedInAppEvents),
      blockedReasons,
      rejectedReasons,
      blockedByMediaSource,
      blockedByCampaign,
    };
  }

  async getSemanticSeedEvents(projectId: string, filters: Pick<AppsFlyerEventFilters, 'importId' | 'reportType'> = {}) {
    const clauses = [`project_id = ${this.client.escape(projectId)}`, "source = 'APPSFLYER'"];
    if (filters.importId) clauses.push(`import_id = ${this.client.escape(filters.importId)}`);
    if (filters.reportType) clauses.push(`report_type = ${this.client.escape(filters.reportType)}`);

    return this.client.query(
      `SELECT
        coalesce(media_source, 'unknown') AS mediaSource,
        coalesce(campaign_name, 'unknown') AS campaignName,
        campaign_id AS campaignId,
        event_name AS eventName,
        canonical_event_name AS canonicalEventName,
        count() AS events
       FROM marketing.marketing_events FINAL
       WHERE ${clauses.join(' AND ')}
       GROUP BY media_source, campaign_name, campaign_id, event_name, canonical_event_name
       ORDER BY events DESC
       LIMIT 500`,
    );
  }


  async getMediaSourceQuality(projectId: string, filters: AppsFlyerEventFilters = {}) {
    const rows = await this.client.query<Record<string, unknown>>(
      `SELECT coalesce(nullIf(media_source, ''), 'unknown') AS mediaSource,
        count() AS totalRawEvents, countIf(is_blocked = 0) AS validEvents, countIf(is_blocked = 1) AS blockedEvents,
        if(count() = 0, NULL, countIf(is_blocked = 1) / count()) AS blockedRate,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), ${filters.trafficScope === 'all' ? '1' : 'is_blocked = 0'}) AS uniqueUsers,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.INSTALL}') AS installs,
        countIf(is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.REGISTRATION}','${CanonicalEventType.REGISTRATION_STEP}')) AS registrations,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.REGISTRATION}','${CanonicalEventType.REGISTRATION_STEP}')) AS registrationUsers,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS deposits,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS depositUsers,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS firstDeposits,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS firstDepositUsers,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.DEPOSIT}','${CanonicalEventType.FIRST_DEPOSIT}')) AS depositAmount,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.BET_PLACED}','${CanonicalEventType.SPORTS_BET_PLACED}','${CanonicalEventType.CASINO_BET_PLACED}')) AS betPlacedAmount,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.BET_SETTLEMENT}') AS betSettlementAmount,
        countIf(is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.LOGIN}','${CanonicalEventType.ENGAGEMENT}')) AS engagementEvents,
        countIf(is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.REGISTRATION}','${CanonicalEventType.REGISTRATION_STEP}','${CanonicalEventType.DEPOSIT}','${CanonicalEventType.FIRST_DEPOSIT}')) AS conversionEvents,
        countIf(match(coalesce(campaign_name, ''), '^\\{.*\\}$') OR lower(coalesce(campaign_name, '')) IN ('unknown','none','')) AS badCampaignRows
       FROM marketing.marketing_events FINAL WHERE ${this.whereNoScope(projectId, filters)} GROUP BY mediaSource`,
    );
    return this.rankQuality(rows, 'mediaSource', filters.limit);
  }

  async getCampaignQuality(projectId: string, filters: AppsFlyerEventFilters = {}) {
    const rows = await this.client.query<Record<string, unknown>>(
      `SELECT coalesce(nullIf(media_source, ''), 'unknown') AS mediaSource, coalesce(nullIf(campaign_name, ''), 'unknown') AS campaignName, campaign_id AS campaignId,
        count() AS totalRawEvents, countIf(is_blocked = 0) AS validEvents, countIf(is_blocked = 1) AS blockedEvents, if(count() = 0, NULL, countIf(is_blocked = 1) / count()) AS blockedRate,
        uniqExactIf(coalesce(nullIf(customer_user_id, ''), nullIf(appsflyer_id, ''), row_hash), is_blocked = 0) AS uniqueUsers,
        countIf(is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.REGISTRATION}','${CanonicalEventType.REGISTRATION_STEP}')) AS registrations,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.DEPOSIT}') AS deposits,
        countIf(is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.FIRST_DEPOSIT}') AS firstDeposits,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.DEPOSIT}','${CanonicalEventType.FIRST_DEPOSIT}')) AS depositAmount,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.BET_PLACED}','${CanonicalEventType.SPORTS_BET_PLACED}','${CanonicalEventType.CASINO_BET_PLACED}')) AS betPlacedAmount,
        sumIf(toFloat64OrZero(toString(event_amount)), is_blocked = 0 AND canonical_event_name = '${CanonicalEventType.BET_SETTLEMENT}') AS betSettlementAmount,
        countIf(is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.REGISTRATION}','${CanonicalEventType.REGISTRATION_STEP}','${CanonicalEventType.DEPOSIT}','${CanonicalEventType.FIRST_DEPOSIT}')) AS conversionEvents,
        countIf(is_blocked = 0 AND canonical_event_name IN ('${CanonicalEventType.LOGIN}','${CanonicalEventType.ENGAGEMENT}')) AS engagementEvents,
        match(coalesce(campaign_name, ''), '^\\{.*\\}$') AS hasInvalidMacros, lower(coalesce(campaign_name, '')) IN ('unknown','none','') AS hasUnknownCampaign, coalesce(campaign_id, '') = '' AS hasMissingCampaignId
       FROM marketing.marketing_events FINAL WHERE ${this.whereNoScope(projectId, filters)} GROUP BY mediaSource, campaignName, campaignId`,
    );
    return this.rankQuality(rows, 'campaignName', filters.limit);
  }

  async getEventDictionaryCoverage(projectId: string, filters: AppsFlyerEventFilters = {}) {
    const rows = await this.getEventsByName(projectId, { ...filters, trafficScope: 'all' });
    const totalEventNames = rows.length;
    const unknown = rows.filter((r: any) => r.canonicalEventName === CanonicalEventType.UNKNOWN);
    const total = rows.reduce((s: number, r: any) => s + this.num(r.count), 0);
    const unknownCount = unknown.reduce((s: number, r: any) => s + this.num(r.count), 0);
    return { totalEventNames, mappedEventNames: totalEventNames - unknown.length, unknownEventNames: unknown.length, mappedEventsCount: total - unknownCount, unknownEventsCount: unknownCount, mappingCoverageByEventCount: total ? (total - unknownCount) / total : null, mappingCoverageByEventName: totalEventNames ? (totalEventNames - unknown.length) / totalEventNames : null, topUnknownEvents: unknown.map((r: any) => ({ ...r, suggestedCanonicalEvent: this.suggestCanonicalEvent(r.eventName) })).sort((a:any,b:any)=>this.num(b.count)-this.num(a.count)).slice(0, 50), topUnknownEventsByAmount: [...unknown].sort((a:any,b:any)=>this.num(b.totalAmount)-this.num(a.totalAmount)).slice(0, 50), topUnknownEventsByUniqueUsers: [...unknown].sort((a:any,b:any)=>this.num(b.uniqueUsers)-this.num(a.uniqueUsers)).slice(0, 50) };
  }

  async getDataQuality(projectId: string, filters: AppsFlyerEventFilters = {}) {
    const coverage = await this.getEventDictionaryCoverage(projectId, filters);
    const rows = await this.client.query<Record<string, unknown>>(`SELECT count() AS rowCount, countIf(match(coalesce(campaign_name, ''), '^\\{.*\\}$')) AS invalidMacroRows, countIf(lower(coalesce(campaign_name, '')) IN ('unknown','none','')) AS unknownCampaignRows, countIf(coalesce(campaign_id, '') = '') AS missingCampaignIdRows, countIf(lower(coalesce(media_source, '')) IN ('unknown','restricted')) AS unknownMediaSourceRows, countIf(event_revenue IS NOT NULL AND event_revenue != 0) AS nonEmptyEventRevenueRows, countIf(event_amount IS NOT NULL AND event_amount != 0) AS nonEmptyEventAmountRows FROM marketing.marketing_events FINAL WHERE ${this.whereNoScope(projectId, filters)}`);
    const row = rows[0] ?? {}; const issues:any[]=[]; const recs:string[]=[];
    const add=(code:string,severity:string,message:string,metrics:Record<string,unknown>)=>{issues.push({code,severity,message,metrics}); recs.push(message)};
    if (this.num(row.invalidMacroRows)>0) add('INVALID_CAMPAIGN_MACROS_DETECTED','warning','Fix unresolved campaign macros before relying on campaign quality.',{rows:this.num(row.invalidMacroRows)});
    if (this.num(row.unknownCampaignRows)>0 || this.num(row.missingCampaignIdRows)>0) add('UNKNOWN_CAMPAIGN_METADATA','warning','Campaign metadata is missing or unknown for some rows.',{unknownCampaignRows:this.num(row.unknownCampaignRows),missingCampaignIdRows:this.num(row.missingCampaignIdRows)});
    if (this.num(row.nonEmptyEventRevenueRows)===0 && this.num(row.rowCount)>0) add('EVENT_REVENUE_EMPTY','warning','Event Revenue is empty; monetary signals use Event Value.amount when present.',{nonEmptyEventRevenueRows:0});
    if (this.num(row.nonEmptyEventAmountRows)>0) add('EVENT_AMOUNT_IN_JSON','info','Event Value.amount is present and used as a monetary event-value signal, not ad cost.',{nonEmptyEventAmountRows:this.num(row.nonEmptyEventAmountRows)});
    add('NO_RELIABLE_COST_SOURCE','info','AppsFlyer imports do not provide reliable ad cost for ROAS/CPA/CAC.',{hasReliableCost:false});
    if ((coverage.mappingCoverageByEventCount ?? 1) < 0.8) add('HIGH_UNKNOWN_EVENT_MAPPING_RATE','warning','Unknown event mappings may affect analysis quality.',{mappingCoverageByEventCount:coverage.mappingCoverageByEventCount,unknownEventsCount:coverage.unknownEventsCount});
    if ([200000,500000,1000000].includes(this.num(row.rowCount))) add('EXPORT_LIMIT_REACHED','warning','The export row count matches a common AppsFlyer export limit.',{rowCount:this.num(row.rowCount)});
    const warnings=issues.filter(i=>i.severity==='warning').length, criticalIssues=issues.filter(i=>i.severity==='critical').length;
    return { summary:{ score: Math.max(0,100-warnings*7-criticalIssues*20), status: criticalIssues?'critical':warnings?'warning':'ok', criticalIssues, warnings }, issues, invalidMacros:{ rows:this.num(row.invalidMacroRows) }, missingFields:{ unknownCampaignRows:this.num(row.unknownCampaignRows), missingCampaignIdRows:this.num(row.missingCampaignIdRows), unknownMediaSourceRows:this.num(row.unknownMediaSourceRows) }, eventRevenueStatus:{ nonEmptyRows:this.num(row.nonEmptyEventRevenueRows), mostlyEmpty:this.num(row.nonEmptyEventRevenueRows)===0 }, eventValueAmountStatus:{ nonEmptyRows:this.num(row.nonEmptyEventAmountRows), usedAsMonetarySource:this.num(row.nonEmptyEventAmountRows)>0 }, unknownEventMapping:coverage, recommendations:recs };
  }

  private whereNoScope(projectId: string, filters: AppsFlyerEventFilters): string {
    const clauses = [`project_id = ${this.client.escape(projectId)}`, "source = 'APPSFLYER'"];
    if (filters.from) clauses.push(`event_date >= toDate(${this.client.escape(filters.from)})`);
    if (filters.to) clauses.push(`event_date <= toDate(${this.client.escape(filters.to)})`);
    if (filters.importId) clauses.push(`import_id = ${this.client.escape(filters.importId)}`);
    if (filters.reportType) clauses.push(`report_type = ${this.client.escape(filters.reportType)}`);
    return clauses.join(' AND ');
  }

  private rankQuality(rows: Record<string, unknown>[], _key: string, limit?: number) {
    const maxFtd = Math.max(1, ...rows.map(r=>this.num(r.firstDepositUsers ?? r.firstDeposits)));
    const maxDepUsers = Math.max(1, ...rows.map(r=>this.num(r.depositUsers ?? r.deposits)));
    const maxDepAmount = Math.max(1, ...rows.map(r=>this.num(r.depositAmount)));
    const maxReg = Math.max(1, ...rows.map(r=>this.num(r.registrationUsers ?? r.registrations)));
    return rows.map(r=>{ const valid=this.num(r.validEvents), blocked=this.num(r.blockedEvents), total=this.num(r.totalRawEvents), noisy=valid?this.num(r.engagementEvents)/valid:0; const missing=this.num((r as any).badCampaignRows)>0 || this.num(r.hasUnknownCampaign)>0 || this.num(r.hasMissingCampaignId)>0; const breakdown={firstDepositUsers:this.num(r.firstDepositUsers ?? r.firstDeposits)/maxFtd*30,depositUsers:this.num(r.depositUsers ?? r.deposits)/maxDepUsers*25,depositAmount:this.num(r.depositAmount)/maxDepAmount*25,registrationUsers:this.num(r.registrationUsers ?? r.registrations)/maxReg*20,blockedRatePenalty:(total?blocked/total:0)*35,noisyEventRatioPenalty:noisy*10,metadataPenalty:missing?10:0}; const score=Math.max(0,Math.min(100,breakdown.firstDepositUsers+breakdown.depositUsers+breakdown.depositAmount+breakdown.registrationUsers-breakdown.blockedRatePenalty-breakdown.noisyEventRatioPenalty-breakdown.metadataPenalty)); const reasons:string[]=[]; if(blocked/Math.max(1,total)>0.5) reasons.push('Traffic-quality risk: blocked events are close to or above valid events.'); if(this.num(r.depositAmount)>0) reasons.push('Has monetary event-value signal from Event Value.amount.'); if(missing) reasons.push('Missing, unknown, or placeholder campaign metadata penalized the score.'); return {...r, qualityScore:Number(score.toFixed(2)), score:Number(score.toFixed(2)), scoreBreakdown:breakdown, noisyEventRatio:noisy, netBetAmountApprox:this.num(r.betSettlementAmount)-this.num(r.betPlacedAmount), depositUsersRate:this.num(r.uniqueUsers)?this.num(r.depositUsers ?? r.deposits)/this.num(r.uniqueUsers):null, ftdUsersRate:this.num(r.uniqueUsers)?this.num(r.firstDepositUsers ?? r.firstDeposits)/this.num(r.uniqueUsers):null, installToRegistrationRate:this.num(r.installs)?this.num(r.registrationUsers ?? r.registrations)/this.num(r.installs):null, installToDepositRate:this.num(r.installs)?this.num(r.depositUsers ?? r.deposits)/this.num(r.installs):null, installToFtdRate:this.num(r.installs)?this.num(r.firstDepositUsers ?? r.firstDeposits)/this.num(r.installs):null, reasons:reasons.length?reasons:['Ranked by deterministic AppsFlyer quality score.'], limitations:['No reliable cost source; this is not ROAS, CPA, CAC, or profitability.']}; }).sort((a:any,b:any)=>b.qualityScore-a.qualityScore).map((r,i)=>({...r, rank:i+1})).slice(0, limit ?? 100);
  }

  private suggestCanonicalEvent(eventName: unknown): string {
    const key=String(eventName??'').toLowerCase();
    if(key.startsWith('placebet_success_')) return 'SPORTS_BET_PLACED';
    if(key.includes('first_casino_bet')) return 'FIRST_BET';
    if(key.includes('login_submitted')) return 'LOGIN';
    if(key.includes('register_submitted')||key.includes('joinnow_submitted')) return 'REGISTRATION_STEP';
    if(key.includes('register_error')) return 'REGISTRATION_ERROR';
    if(key.includes('first_withdraw')) return 'FIRST_WITHDRAW';
    if(key.includes('click')) return 'CLICK';
    if(key.includes('re-attribution')) return 'REATTRIBUTION';
    return 'REVIEW_REQUIRED';
  }

  private where(projectId: string, filters: AppsFlyerEventFilters): string {
    const clauses = [`project_id = ${this.client.escape(projectId)}`, "source = 'APPSFLYER'"];
    if (filters.from) clauses.push(`event_date >= toDate(${this.client.escape(filters.from)})`);
    if (filters.to) clauses.push(`event_date <= toDate(${this.client.escape(filters.to)})`);
    if (filters.importId) clauses.push(`import_id = ${this.client.escape(filters.importId)}`);
    if (filters.reportType) clauses.push(`report_type = ${this.client.escape(filters.reportType)}`);
    if (filters.mediaSource) clauses.push(`media_source = ${this.client.escape(filters.mediaSource)}`);
    if (filters.campaignName) clauses.push(`campaign_name = ${this.client.escape(filters.campaignName)}`);
    if (filters.canonicalEventName) clauses.push(`canonical_event_name = ${this.client.escape(filters.canonicalEventName)}`);
    if (filters.trafficScope === 'valid' || !filters.trafficScope) clauses.push('is_blocked = 0');
    if (filters.trafficScope === 'blocked') clauses.push('is_blocked = 1');
    return clauses.join(' AND ');
  }

  private num(value: unknown): number { return Number(value ?? 0); }
}
