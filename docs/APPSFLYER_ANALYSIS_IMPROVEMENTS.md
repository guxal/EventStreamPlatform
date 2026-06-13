# AppsFlyer Analysis Improvements

This layer improves the existing AppsFlyer V1 backend without changing Bronze upload, Silver normalization, raw CSV storage, or worker processing semantics.

## Clean vs blocked traffic

Performance readers default to `trafficScope=valid`, which adds `is_blocked = 0` to performance-style queries. Fraud and traffic-quality readers use blocked rows separately. Dashboard summaries expose raw, valid, and blocked totals with `blockedRate`, `validEventRate`, and `isBlockedIncluded` so frontend cards do not need to infer whether blocked traffic was mixed into clean KPIs.

## Media source quality ranking

`GET /projects/:id/quality/media-sources?source=appsflyer` ranks media sources from normalized ClickHouse `marketing.marketing_events` only. The deterministic V1 score rewards first-deposit users, deposit users, deposit amount, and registration users, and penalizes blocked rate, noisy engagement-heavy distributions, and missing/placeholder campaign metadata. It is a quality score, not ROAS, CPA, CAC, or profitability.

## Campaign quality ranking

`GET /projects/:id/quality/campaigns?source=appsflyer` groups by media source, campaign name, and campaign ID. It returns valid and blocked counts, blocked rate, conversion/engagement signals, metadata flags, transparent score breakdown, reasons, limitations, and ranks. Campaigns where blocked events dominate are flagged as traffic-quality risks.

## Event dictionary coverage

`GET /projects/:id/events/dictionary-coverage?source=appsflyer` reports event-name and event-volume mapping coverage and ranks unknown events by count, amount, and users. Suggestions are deterministic pattern matches such as `placebet_success_* -> SPORTS_BET_PLACED`; AI is not used as the mapper.

## Data quality report

`GET /projects/:id/data-quality?source=appsflyer` deterministically detects unresolved campaign macros, unknown campaign/source metadata, empty Event Revenue, Event Value.amount usage, missing reliable cost source, export-limit row counts, and high unknown event mapping rates. The output includes structured `summary`, `issues`, `invalidMacros`, `missingFields`, `eventRevenueStatus`, `eventValueAmountStatus`, `unknownEventMapping`, and `recommendations` sections.

## New deterministic facts

Project analysis can emit AppsFlyer project-scope facts for high blocked traffic and data-quality issues. Facts remain facts-first and include source, PROJECT scope, metrics summary, temporal context, and recommendation hints.

## AI context usage

Controlled questions can include `trafficQualitySummary`, `mediaSourceQualityRanking`, `campaignQualityRanking`, `eventDictionaryCoverage`, `dataQualitySummary`, unavailable metrics, and limitations. AI may explain these deterministic outputs but must not calculate them, inspect raw CSV, treat blocked traffic as valid performance, or claim ROAS/CPA/CAC without reliable cost data.

## Dashboard expectations

The dashboard exposes clean traffic KPIs, blocked traffic KPIs, media/campaign quality rankings, data quality warnings, event dictionary coverage, top unknown events, blocked-source/campaign distributions, and available-vs-missing data as structured objects with labels/status/reasons instead of `[object Object]` strings.

## Limitations before Google Ads

AppsFlyer-only analysis has no reliable ad-cost source. Monetary values from `Event Value.amount` are event-value signals only and must not be interpreted as spend, profit, ROAS, CPA, or CAC.
