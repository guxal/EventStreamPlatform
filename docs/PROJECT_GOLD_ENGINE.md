# Project Gold Engine

## Architecture overview

The Project Gold Engine adds project-level Gold analysis to the existing EventStream Platform / AI Marketing Copilot V1 pipeline. It does **not** replace Bronze, Silver, or import-level Gold processing.

```text
Multiple AppsFlyer imports
→ ClickHouse marketing.marketing_events (Silver)
→ recompute-project-gold job
→ ProjectGoldRecomputeService
→ deterministic project KPIs/funnels/media-source quality/blocked traffic
→ project-scope metric snapshots + detected_facts
→ facts-first project AI report + recommendations
→ reader endpoints and controlled questions
```

The engine reads normalized Silver events from ClickHouse. It never reads raw CSV files, never reprocesses raw uploads, and never asks AI to calculate joins.

## Import-level vs project-level analysis

Import-level analysis remains useful for validating one file/report at a time, for example a single `installs` or `blocked_in_app_events` import. Project-level analysis combines all processed AppsFlyer report types for a project/date range so questions such as install → FTD rate, media-source quality, and blocked traffic impact can be answered from one deterministic Gold context.

## Supported AppsFlyer report types

The V1 project engine recognizes:

- `installs`
- `in_app_events`
- `non_organic_in_app_events`
- `in_app_events_postbacks`
- `conversions`
- `blocked_installs`
- `blocked_clicks`
- `blocked_in_app_events`
- `ad_revenue`
- `uninstalls`

## Data availability

Before computing KPIs, the engine records which report types exist and the limitations created by missing data. AppsFlyer-only analysis always marks `hasReliableCost = false`; ROAS, CPA, and CAC remain unavailable until a reliable cost source is added.

## Period funnel definition

The period funnel is calculated over valid, non-blocked events in the selected date range:

- installs = `canonical_event_name = INSTALL`
- registrations = unique users with `REGISTRATION`
- deposits = unique users with `DEPOSIT`
- FTD = unique users with `FIRST_DEPOSIT`
- monetary event values = sums of `event_amount` for deposit/bet events

Install-based rates are only emitted when install users exist. If installs are missing, the engine records limitations and emits project-level incomplete-funnel facts.

## Cohort funnel definition

The cohort funnel starts from non-blocked install users in the selected date range, then matches post-install events for the same user by identity key. Supported cumulative windows are D0, D1, D3, D7, and D30.

Cohort matching uses deterministic ClickHouse joins and does not load all project rows into memory. If identifiers or installs are missing, the cohort funnel is marked incomplete and period funnel remains the fallback.

## Identity matching rules

Current V1 matching priority is:

1. `customer_user_id`
2. `appsflyer_id`
3. row-hash fallback for period-only counts when identifiers are unavailable

Cohort matching requires a stable customer/Appsflyer identifier and does not fake rates when identity coverage is insufficient.

## Blocked traffic handling

Blocked traffic is excluded from the main funnel and analyzed separately. The engine computes blocked install rate, blocked in-app event rate, blocked reasons, and blocked media-source distribution. High blocked rates generate project-level traffic-quality/fraud facts.

## Media-source quality

Media-source quality is deterministic and transparent. The V1 score rewards FTD rate, deposit rate, and normalized deposit amount, and penalizes blocked rate and noisy engagement-heavy event mixes. It is **not** a profitability score because cost is unavailable from AppsFlyer alone.

## Project facts

Project facts are persisted with:

- `scope_type = PROJECT`
- `scope_id = project_id`
- `analysis_run_id = project_analysis_runs.id`
- `source = appsflyer`
- date range fields

Important project fact types include funnel availability/incompleteness, cohort availability/incompleteness, missing reports, no reliable cost source, event revenue limitations, high blocked traffic, media-source quality difference, noisy event distribution, identity coverage, and project analysis readiness.


## AI chat / questions context

Project Gold is the preferred context source for controlled AI questions that ask about the whole project, traffic quality, media-source quality, install-to-FTD rates, missing data, or ROAS availability. The controlled question layer should use project-level Gold in this order when no `importId` is provided:

1. Project Gold summary (`projectGold`) with KPIs, availability, funnels, media-source quality, blocked traffic, and limitations.
2. Project-scope detected facts (`scope_type = PROJECT`).
3. Project-scope recommendations and reports.
4. Import-level facts only as supporting evidence or when the user explicitly filters by an import.

If Project Gold does not exist, AI must say project-level analysis has not been computed yet and suggest `recompute-project-gold`. It must not infer project-level rates from isolated import-level facts.

## What “full context” means

For Project Gold and AI chat, “full context” means complete bounded aggregates needed for project diagnosis, not raw data access. The AI can receive:

- Project-level KPIs and data availability.
- Period and cohort funnel summaries.
- Media-source quality summaries and top reasons.
- Blocked traffic totals/rates, blocked reason distributions, and blocked media-source distributions.
- Project facts, recommendations, reports, semantic entities, relationships, context objects, warnings, and unavailable metrics.

The AI must not receive raw CSV files, raw rows, raw payloads, unbounded event lists, or user/device identifiers. Numeric KPIs must remain deterministic outputs from ClickHouse aggregations.

## Project AI summary

The project AI summary is generated only from project KPIs, project facts, bounded semantic/context objects, and data-availability limitations. AI does not read raw rows or CSVs and must explicitly state limitations such as missing cost data, period-vs-cohort differences, Event Value.amount monetary source, and blocked-traffic exclusion from the main funnel.

## Endpoints

Manual recompute:

```http
POST /projects/:id/analysis/recompute
```

Body:

```json
{
  "source": "appsflyer",
  "dateRangeStart": "2026-05-14",
  "dateRangeEnd": "2026-05-21",
  "force": true
}
```

Reader endpoints:

```http
GET /projects/:id/analysis/summary
GET /projects/:id/analysis/funnel
GET /projects/:id/analysis/media-sources
GET /projects/:id/facts?scope=PROJECT&source=appsflyer
GET /projects/:id/recommendations?scope=PROJECT&source=appsflyer
GET /projects/:id/reports?scope=PROJECT&source=appsflyer
```

## Recompute job

Queue: `project-analysis`

Job: `recompute-project-gold`

Payload includes project ID, source, optional date range, trigger (`post_import`, `manual`, or later `scheduled`), correlation ID, and force flag.

Automatic post-import recompute is enqueued after a successful AppsFlyer import completes.

## Idempotency

For the same project/source/date range, recompute replaces project-scope outputs before inserting fresh results:

- ClickHouse project metric snapshots are deleted/reinserted for the project scope.
- PostgreSQL project detected facts are deleted/reinserted by project/source/date range.
- Project recommendations and reports are replaced by project scope through the existing AI output repositories.

Previous successful analysis remains available if a later run fails before replacement of its stage-specific outputs.

## Troubleshooting

- `Project-level analysis has not been computed yet`: run `POST /projects/:id/analysis/recompute` after processing AppsFlyer files.
- Missing cohort rates: verify installs and event reports include customer/Appsflyer identifiers.
- ROAS unavailable: add a reliable cost source in a future Google Ads/paid media integration; AppsFlyer event amount is not cost.
- Empty monetary metrics: AppsFlyer `Event Revenue` may be empty; check whether `Event Value.amount` was parsed.
