# AppsFlyer + Medallion Implementation Notes (V1 Backend)

## Current backend status

AppsFlyer processing now starts after the File Hub/Bronze Layer has already uploaded, profiled, and classified a CSV file. The worker path is:

```txt
POST /projects/:id/files/:fileId/process
→ create/reuse data_import
→ link raw_import_files.data_import_id
→ publish marketing-imports/process-marketing-import
→ processor-worker streams object storage file
→ AppsFlyer plugin pipeline
→ ClickHouse marketing.marketing_events
→ KPI snapshot
→ PostgreSQL detected_facts
→ optional facts-first AI outputs
→ COMPLETED or FAILED with error_stage
```

The processing endpoint is intentionally AppsFlyer-only for this V1 slice. Google Ads and AppsFlyer + Google Ads joins remain out of scope for this task.

## Supported AppsFlyer report types

The worker accepts the existing `ReportType` values below when `source = APPSFLYER`:

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

Unknown report types and non-AppsFlyer sources are rejected before processing.

## Fact generation status

Yes: AppsFlyer facts are generated as part of the worker pipeline, not by AI and not from raw CSV directly.

The worker executes the AppsFlyer pipeline, receives `result.facts`, and persists them with `DetectedFactRepository.saveMany(projectId, result.facts)`. AI recommendations/reports are attempted only after facts have been generated and persisted, and AI failures are logged as a warning instead of failing the import.

Fact inputs are:

- File/profile metadata such as row count and export-limit matches.
- Normalized AppsFlyer events.
- KPI/statistical summaries from normalized events.

Generated AppsFlyer fact types include:

- `EMPTY_REPORT`
- `DATA_EXPORT_LIMIT_REACHED`
- `EVENT_REVENUE_EMPTY`
- `EVENT_AMOUNT_IN_JSON`
- `HIGH_BLOCKED_TRAFFIC_RATE`
- `HIGH_BLOCKED_IN_APP_EVENTS`
- `NO_RELIABLE_COST_SOURCE`
- `MEDIA_SOURCE_QUALITY_DIFFERENCE`
- `NOISY_EVENT_DISTRIBUTION`

Important guardrails:

- Do not generate ROAS facts from AppsFlyer-only data because AppsFlyer is not treated as a reliable cost source in this V1 task.
- Do not calculate or generate install-to-deposit/FTD rate facts unless comparable install and event data exists for the same project/date range.
- AI outputs must be facts-first. AI must not read raw CSV.

## Plugin sequence

The AppsFlyer pipeline is plugin-based:

```txt
AppsFlyerReportProfilerPlugin
→ AppsFlyerCsvStreamParserPlugin
→ AppsFlyerColumnMapper
→ AppsFlyerEventValueParserPlugin
→ AppsFlyerNormalizerPlugin
→ AppsFlyerEventDictionaryPlugin
→ AppsFlyerKpiCalculatorPlugin
→ AppsFlyerFactsPlugin
→ AiOutputOrchestratorService optional after facts
```

Responsibilities:

- The profiler prefers the existing File Hub profile when available and only re-profiles from stream when needed.
- The parser reads CSV rows from a stream and records row-level warnings instead of loading the full file into memory.
- The mapper tolerates AppsFlyer header casing, spaces, underscores, hyphens, and minor naming variants.
- The Event Value parser extracts `amount` from JSON when present and keeps malformed values as row warnings.
- The normalizer emits ClickHouse-compatible `marketing_events` rows with `row_hash`.
- The KPI calculator computes AppsFlyer-safe event, user, blocked traffic, deposit, FTD, bet amount summaries, and the source event-date period without ROAS.
- The facts plugin converts profile/KPI signals into deterministic `DetectedFact` payloads.


## Gold Layer: KPI snapshots

AppsFlyer KPI snapshots are written to ClickHouse table `marketing.marketing_metric_snapshots` during `GOLD_KPI_CALCULATION`.

For AppsFlyer-only imports, the snapshot stores:

- `source_run_id = data_imports.id` so the reader can attach KPIs to `GET /projects/:id/appsflyer/imports/:importId/summary`.
- `period_start`, `period_end`, and `as_of_date` from the normalized AppsFlyer event-date range, with a processing-date fallback only when no event dates are available.
- `conversions = registrations + deposits + first_deposits`.
- `conversion_value = depositAmount`.
- The full AppsFlyer-safe KPI payload in `context_metadata` for event/user/media-source/campaign/country/platform summaries and unavailable cost metrics.

ClickHouse writes are required for AppsFlyer processing. If ClickHouse is not configured, the worker fails the import instead of silently completing with PostgreSQL facts but missing Silver/Gold KPI data.

## Silver Layer: `marketing.marketing_events`

Normalized AppsFlyer rows are inserted into ClickHouse table `marketing.marketing_events`.

The table uses `ReplacingMergeTree(created_at)` with:

```txt
ORDER BY (project_id, import_id, row_hash)
```

This keeps `import_id + row_hash` as the logical retry/idempotency key. Queries that must collapse retry duplicates should use `FINAL` or an import-replace strategy before reinserting.

## Idempotency for `marketing_events`

For AppsFlyer imports, row-level dedupe with `import_id + row_hash` is not enough by itself when using ClickHouse merge-tree engines.

Recommended strategy order for future hardening:

1. **IMPORT_REPLACE**: delete all rows for `import_id` before batch reinsert on retry.
2. **REPLACING_MERGETREE_FINAL**: if replacement-by-version is used, aggregate queries that feed KPI calculators should use `FINAL` where correctness is required.

## Event Value defensive parsing

`Event Value` may contain malformed JSON or unexpected key/value pairs.

Parser guidance:

1. Try strict JSON parsing first.
2. Extract monetary keys such as `amount`, `af_revenue`, or `revenue` when parse succeeds.
3. Never fail the whole stream for one malformed row; register a warning and continue.

## Stream-only processing

Use direct object-storage stream -> CSV parser -> normalizer -> ClickHouse bulk insert.
Avoid writing full temp CSV files on container disk for large AppsFlyer exports.

## Time fields for delayed-reward analytics

Keep the following normalized timestamps in Silver events:

- `event_time`
- `install_time`
- `attributed_touch_time`

These are required for attribution lag analysis and historical recomputation of Gold snapshots.

## Failure handling

On worker failure:

- `data_imports.status = FAILED`
- `raw_import_files.status = FAILED`
- `error_stage` is saved when available.
- `error_message` and `error_summary` are saved for debugging.

Current stages include request validation, bronze profiling, silver parsing/normalization/persistence, gold KPI/fact generation, and AI output generation.
