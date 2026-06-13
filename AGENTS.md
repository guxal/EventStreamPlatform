# AI Marketing Copilot — AGENTS Instructions

## Purpose
This file is the implementation guide and feedback memory for future AI/code agents working on this repository.

We are extending the existing EventStream Platform into an AI Marketing Copilot **without rebuilding from zero**.


## Current Project Status Snapshot (Updated)
- Canonical working backend slice: File Hub raw CSV upload → AppsFlyer stream processing → ClickHouse Silver/Gold writes → PostgreSQL facts/audit/semantic/context → facts-first AI outputs → controlled questions/chat.
- Explicit AI analysis runs are implemented independently from imports through `POST /projects/:id/analysis-runs`, the `marketing-analysis` queue, and the `generate-ai-analysis` worker job.
- Chat with IA is now the controlled questions layer: `POST /projects/:id/questions` is preferred and `POST /projects/:id/ai-chat` remains a compatibility alias. The flow is intent routing → bounded data function → provider/fallback answer.
- The framework-free HTML/JavaScript test UI lives at `apps/admin/src/assets/atlas-ai-test-ui.html` and is served by `apps/admin` from `/api/ui` (admin default port `3002`).
- Current production-like processing is AppsFlyer CSV. Google Ads CSV remains the next milestone for the original V1 target.

## Epic 0 Status (Completed)
- E0-1: Architecture target confirmed: extend existing EventStream core.
- E0-2: Metrics storage selected: **ClickHouse** for V1.
- E0-3: This `AGENTS.md` created as persistent implementation guide.
- E0-4: Naming convention defined to avoid platform-name drift.

## Epic 1 Status (Completed)
- E1-1 to E1-4: Marketing libraries scaffolded (`marketing-shared`, `marketing-application`, `marketing-infrastructure`, `marketing-plugins`).
- E1-5: Base enums created (`EntityType`, `FactType`, `Severity`, `ImportStatus`, `Platform`).
- E1-6: Base contracts created (`DetectedFact`, `TemporalContext`, `IAnalysisPlugin`).

## Epic 2 Status (Completed)
- E2-1 to E2-11: Initial PostgreSQL migration created with all planned V1 tables.
- E2-12: Initial index set added for project/entity/fact/date-oriented queries.
- E2-13: Import status transitions enforced via `data_imports_status_chk`.

## Epic 3 Status (Completed)
- E3-1: `marketing_daily_metrics` ClickHouse table created.
- E3-2: `marketing_metric_snapshots` ClickHouse table created.
- E3-3: Unified schema columns included (project/integration/entity/date/KPIs/currency/timezone/context).
- E3-4: Bulk-insert-friendly MergeTree schema and ordering keys defined.
- E3-5: Idempotency strategy documented via ReplacingMergeTree version columns (`ingested_at` / `created_at`).

## Epic 5 Status (Completed)
- E5-1: Writer import payload extended for CSV content metadata and object-key generation.
- E5-2: Raw-import storage metadata (provider/bucket/object key) captured in import records.
- E5-3: BullMQ job publication implemented with `process-marketing-import` on `marketing-imports` queue.
- E5-4: Retry/backoff policy configured (attempts=3, exponential backoff).
- E5-5: Trace ID emitted per import job payload for observability.
- E5-6: CSV payload is now written to object storage adapter before queue publish.

## Epic 6 Status (Completed)
- E6-1/E6-2 equivalent AI layer foundation implemented in `marketing-application` for facts-driven recommendations and reports.
- E6-3: Defensive AI system prompt added with strict constraints (facts-only, no invented metrics/trends).
- E6-4: Recommendation/report generation implemented from detected facts contracts.
- E6-5: Explicit insufficient-data handling added in report generation when facts are empty.

## Epic 7 Status (Completed)
- Implemented analysis engine service with plugin orchestration in `marketing-plugins`.
- Added 8 V1 rules: HIGH_SPEND_ZERO_CONVERSIONS, LOW_CTR, HIGH_CPC, HIGH_CPA, LOW_ROAS, KEYWORD_WASTE, SCALING_OPPORTUNITY, DATA_QUALITY_WARNING.
- Added deterministic thresholds and typed input contract for analysis metric rows.
- All rules output structured `DetectedFact` payloads with severity/confidence/metrics summary.

## Epic 8 Status (Completed)
- E8-1: Defensive prompt already enforced (`AI_DEFENSIVE_SYSTEM_PROMPT`).
- E8-2: Recommendations generation + persistence orchestration implemented from `DetectedFact[]`.
- E8-3: Reports generation + persistence orchestration implemented from `DetectedFact[]`.
- E8-4: Repository layer added for `recommendations` and `ai_reports` persistence abstraction.
- E8-5: Empty-facts/insufficient-data flow preserved in report output generation.

## Epic 9 Status (Completed)
- Implemented reader endpoints: dashboard, campaigns, keywords, facts, recommendations, reports, and ai-chat.
- Preserved existing metrics endpoints under `/metrics` and merged them into root reader controller.
- Added reader DTO/types for dashboard/campaign/keyword/chat payloads.


## Epic 10 Status (Completed) — File Hub / Import Hub Bronze Layer
- Backend File Hub foundation implemented as the raw-file control center before worker processing.
- Upload behavior is now: upload CSV → object storage → stream profile → deterministic classification → manual review when needed → process only when `READY_TO_PROCESS`.
- API Writer endpoints added under `/api/projects/:id/files` for upload, list, detail, manual tagging, and processing trigger.
- Swagger tag `file-hub` added so Bronze Layer endpoints are separated from core `events`, `projects`, and legacy `imports` docs.
- `FileHubService`, `FileProfilerService`, and `ReportClassifierService` added in `marketing-application`.
- `ObjectStorageService.getObjectStream`, `RawImportFileRepository`, `DataImportRepository`, and project/file-hub repositories added in `marketing-infrastructure`.
- PostgreSQL migration `005_extend_raw_import_files_for_file_hub.sql` extends raw file metadata for profile, classification, tags, statuses, checksum, storage, and processing linkage.
- File Hub currently permits processing only for AppsFlyer files with known source/report type; Google Ads processing and AppsFlyer + Google Ads joins remain future work.

## Epic 11 Status (Completed) — AppsFlyer Medallion Processing Slice
- AppsFlyer worker path now starts from the File Hub process trigger and consumes `marketing-imports/process-marketing-import` jobs.
- Stream-only object-storage processing implemented: object stream → AppsFlyer CSV parser → mapper → Event Value parser → normalizer → ClickHouse bulk insert.
- AppsFlyer plugin pipeline added in `marketing-plugins`: report profiler, stream parser, column mapper, event-value parser, normalizer, event dictionary, KPI calculator, and deterministic facts plugin.
- Supported AppsFlyer report types include installs, in-app events, non-organic in-app events, postbacks, conversions, blocked reports, ad revenue, and uninstalls.
- ClickHouse Silver table `marketing.marketing_events` created with `ReplacingMergeTree(created_at)` and logical retry key `(project_id, import_id, row_hash)`.
- AppsFlyer facts are generated deterministically before AI and persisted to PostgreSQL; AI output generation is attempted only after facts are saved.
- AppsFlyer-only guardrail: do not generate ROAS/CPA/CAC facts from AppsFlyer alone because it is not treated as a reliable cost source in V1.
- Worker failure handling now stores status/error summaries on `data_imports` and `raw_import_files`, including error stages for Bronze, Silver, Gold, semantic/context, and AI phases.

## Epic 12 Status (Completed) — Semantic & Context Layer V1.5
- New PostgreSQL semantic/context layer added for AI Marketing Copilot / Atlas AI while keeping metrics in ClickHouse.
- Migration `010_create_semantic_context_layer.sql` creates `semantic_entities`, `semantic_relationships`, and `context_objects`.
- `detected_facts` now supports semantic enrichment via `semantic_entity_id`, `related_semantic_entity_ids`, and `context_object_ids`.
- `SemanticBuilderService`, AppsFlyer semantic adapter, and semantic repositories upsert source-aware entities/relationships from deterministic facts and KPI summaries.
- `ContextBuilderService` builds bounded context objects from import facts/KPIs for later AI grounding.
- `AiContextBuilderService` filters facts by controlled dimensions, redacts raw/CSV fields, bounds context payload size, and includes semantic entities, relationships, context objects, warnings, and unavailable metrics.
- Semantic/context build steps are optional by default; set `SEMANTIC_CONTEXT_STRICT=true` only when failures should fail the import.

## Epic 13 Status (Completed) — Process Audit & AI Provider Metadata
- PostgreSQL migration `008_create_marketing_process_audit.sql` adds `marketing_process_runs` and `marketing_process_steps` for stage-level observability.
- AppsFlyer worker wraps validation, Bronze, Silver, Gold, semantic/context, and AI output generation in audited steps.
- PostgreSQL migration `009_extend_ai_outputs_provider_metadata.sql` adds provider/model/prompt metadata support for recommendations and reports.
- AI provider layer added with mock, OpenAI, Claude, and Gemini provider abstractions; mock remains suitable for deterministic/local tests.

## Existing Core (Do Not Rebuild)
- NestJS + Nx monorepo
- `apps/api-writer`
- `apps/api-reader`
- `apps/processor-worker`
- PostgreSQL + Redis/BullMQ
- Plugin-based + batch/queue processing

## Product Vision
Build an AI Marketing Copilot where users upload marketing CSV files, get normalized entities, KPI calculations, deterministic detected facts, AI recommendations/reports, and controlled AI chat.

## V1 Scope
### Included
- Project creation
- CSV upload
- Raw file storage
- Stream-based CSV parsing
- Normalization
- Metrics calculation
- Deterministic analysis engine
- Detected facts
- AI recommendations/reports
- Reader APIs + controlled chat

### Excluded
- Direct Google Ads API / Meta API integrations
- Autonomous optimization
- Open Text-to-SQL
- Reinforcement learning / predictive ML

## Mandatory Architecture Principles
1. Keep EventStream core untouched; extend via marketing modules.
2. Keep raw data separated from normalized data.
3. Use PostgreSQL for transactional records.
4. Use **ClickHouse** for time-series marketing metrics.
5. CSV processing must be stream-based (no full file-in-memory loading).
6. AI must never analyze raw CSV directly.
7. Analysis engine generates structured facts first; AI only explains/recommends from facts.
8. Chat must be intent-based with controlled functions.
9. Avoid hardcoding a single industry vertical.

## Core Flow (Required)
CSV Upload
→ api-writer
→ S3/MinIO storage
→ BullMQ job
→ processor-worker
→ CSV stream parser plugin
→ normalization plugin
→ metrics calculator plugin
→ ClickHouse storage
→ analysis engine plugin
→ detected_facts
→ AI recommendations/reports
→ api-reader
→ dashboard / AI chat

## Repository Naming Convention (E0-4)
To prevent naming drift:
- **Product name:** `EventStream Platform` (external docs/UI).
- **Feature layer name:** `AI Marketing Copilot` (module/capability name).
- **Internal package scope:** keep existing `@metrics-platform/*` for backward compatibility in V1 unless a dedicated rename migration is approved.

Rule for future changes:
- Do not rename package scopes during V1 delivery.
- New marketing modules should use consistent prefixes:
  - libs: `marketing-*`
  - code symbols: `Marketing*`
  - DB objects: `marketing_*` where applicable.

## Marketing Libraries (Implemented)
- `libs/marketing-shared` — contracts, enums, file-hub/Appsflyer/Semantic types.
- `libs/marketing-application` — File Hub orchestration, AI services/providers, semantic/context builders.
- `libs/marketing-infrastructure` — repositories, object storage, ClickHouse/PostgreSQL adapters.
- `libs/marketing-plugins` — deterministic analysis rules and AppsFlyer processing pipeline.

## PostgreSQL Tables (Implemented / V1-V1.5)
- `projects`
- `integrations`
- `data_imports`
- `raw_import_files`
- `marketing_entities`
- `entity_meta`
- `detected_facts`
- `recommendations`
- `ai_reports`
- `exchange_rates`
- `project_privacy_settings`
- `marketing_process_runs`
- `marketing_process_steps`
- `semantic_entities`
- `semantic_relationships`
- `context_objects`
- `analysis_runs`

## ClickHouse Tables (Implemented)
- `marketing_daily_metrics`
- `marketing_metric_snapshots`
- `marketing.marketing_events`

Recommended metric schema columns:
- project_id
- integration_id
- entity_id
- entity_type
- date
- impressions
- clicks
- cost
- conversions
- conversion_value
- ctr
- cpc
- cpa
- roas
- conversion_rate
- currency
- timezone
- context_metadata

## Detected Fact Contract
All analysis plugins must return structured facts.

```json
{
  "entity_id": "camp_123",
  "entity_type": "campaign",
  "fact_type": "HIGH_SPEND_ZERO_CONVERSIONS",
  "severity": "CRITICAL",
  "confidence": 0.98,
  "temporal_context": {
    "lookback_days": 7,
    "start_date": "2026-05-14",
    "end_date": "2026-05-20"
  },
  "metrics_summary": {
    "current_spend": 1250,
    "clicks": 342,
    "conversions": 0
  },
  "recommendation_hint": "Review search terms, landing page, targeting, or pause the campaign."
}
```

## Analysis Engine V1 Rules
1. HIGH_SPEND_ZERO_CONVERSIONS
2. LOW_CTR
3. HIGH_CPC
4. HIGH_CPA
5. LOW_ROAS
6. KEYWORD_WASTE
7. SCALING_OPPORTUNITY
8. DATA_QUALITY_WARNING

Plugin contract:

```ts
interface IAnalysisPlugin {
  name: string;
  targetEntityType: 'campaign' | 'adgroup' | 'keyword' | 'creative' | 'account';
  execute(projectId: string, timeframe: TemporalContext): Promise<DetectedFact[]>;
}
```

## AI Layer Rules (Defensive)
Correct:
metrics → analysis engine → facts → AI explanation/recommendation/report

Incorrect:
raw CSV → LLM → recommendations

Prompt constraints:
- Only use provided facts.
- Never invent metrics or trends.
- Explicitly state when data is insufficient.
- Explain as a senior growth marketer.

## AI Chat V1
No open Text-to-SQL.

Use controlled intents:
- PROJECT_SUMMARY
- CAMPAIGN_PERFORMANCE
- KEYWORD_PERFORMANCE
- TOP_PROBLEMS
- RECOMMENDATIONS
- GENERATE_REPORT

Flow:
User Query → Intent Classifier → Controlled Function → JSON Result → Final LLM Response


## Latest Implementation Notes — File Hub / Bronze Layer
- File Hub is the canonical raw-file entrypoint. Do not bypass it for new marketing CSV upload flows unless maintaining legacy endpoints.
- Raw files must be stored and profiled before processing; unknown or low-confidence files must move to `NEEDS_REVIEW`, not the worker queue.
- Current raw file lifecycle: `UPLOADED` → `PROFILING` → `PROFILED` → `READY_TO_PROCESS` or `NEEDS_REVIEW` → `PROCESSING` → `COMPLETED`/`FAILED`.
- Manual tagging endpoint can set source/report type and move the file to `READY_TO_PROCESS` when values are known.
- Processing endpoint creates/reuses `data_imports`, links `raw_import_files.data_import_id`, sets raw file `PROCESSING`, and publishes BullMQ job `process-marketing-import` on `marketing-imports`.
- Current process trigger is AppsFlyer-only; reject unknown report types and non-AppsFlyer sources before worker execution.
- File Hub docs live in `docs/architecture/file-hub-bronze-layer.md`; keep that document and this AGENTS memory in sync when behavior changes.

## Latest Implementation Notes — AppsFlyer Medallion Layer
- Current backend flow: File Hub process trigger → worker stream read → AppsFlyer plugins → ClickHouse `marketing.marketing_events` → KPI snapshot in `marketing.marketing_metric_snapshots` (with import-linked AppsFlyer KPI context) → PostgreSQL `detected_facts` → optional semantic/context enrichment → optional facts-first AI outputs.
- Bronze responsibilities: raw upload/profile/classification/status metadata.
- Silver responsibilities: normalized AppsFlyer events in ClickHouse, row hashes, event timestamps, media source/campaign/event dimensions, and idempotency metadata.
- Gold responsibilities: KPI snapshots, deterministic facts, process audit summaries, and AI-ready fact/context bundles.
- For retry/idempotency hardening, prefer import-replace before reinsert for `marketing_events`; use `FINAL` only where query correctness requires collapsing ReplacingMergeTree duplicates. ClickHouse must be configured for worker processing; do not silently complete AppsFlyer imports without Silver/Gold writes.
- Keep processing stream-based. Do not write full temporary CSV files to container disk for large AppsFlyer exports.
- Event Value parsing must be defensive: parse JSON when valid, extract monetary keys such as `amount`/`af_revenue`/`revenue`, record row warnings for malformed values, and never fail the full import for one bad row.
- Preserve `event_time`, `install_time`, and `attributed_touch_time` for delayed-reward attribution and future Gold recomputation.
- AppsFlyer Medallion notes live in `docs/architecture/appsflyer-medallion-implementation-notes.md`; keep that document and this AGENTS memory in sync when behavior changes.

## Latest Implementation Notes — Semantic & Context Layer
- This layer stores semantic knowledge in PostgreSQL only; metrics and event time series remain in ClickHouse.
- Use `semantic_entities` for canonical entities/aliases/sources/metadata, `semantic_relationships` for source-aware links, and `context_objects` for bounded AI grounding text.
- Semantic enrichment links facts back to semantic objects through `detected_facts.semantic_entity_id`, `related_semantic_entity_ids`, and `context_object_ids`.
- AI context must remain facts-first and bounded: filter by controlled dimensions, include unavailable metrics and warnings, and redact raw/CSV fields before provider calls.
- Semantic/context enrichment is optional unless `SEMANTIC_CONTEXT_STRICT=true`; optional failures should not block an otherwise valid import.

## Latest Implementation Notes — AI Providers and Guardrails
- AI outputs must be generated only from detected facts plus bounded KPI/semantic/context extras.
- Provider abstractions exist for mock, OpenAI, Claude, and Gemini; do not instantiate providers directly in feature code when the factory/orchestrator is available.
- Store provider/model/prompt metadata with AI outputs for traceability.
- AI context builder redacts raw/CSV/payload/device/user fields and bounds facts, semantic data, relationships, and context objects before provider calls.
- OpenAI calls use bounded timeout/retry settings (`AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_MAX_TOKENS`) and must not log secrets.
- Import-scoped AI outputs are replace-by-scope (`project_id + import_id + source + report_type`) before regeneration to avoid duplicate recommendations/reports.
- AppsFlyer fact persistence also replaces facts for the same import/source/report/raw-file scope before saving regenerated facts.
- Continue preserving insufficient-data behavior when facts are empty or when required metrics are unavailable.
- AI debug logging is available behind `AI_DEBUG_*` flags through structured JSON events, correlation IDs, sanitization/redaction, raw-data rejection before provider calls, and optional `ai_debug_traces` persistence for local/staging only. See `docs/AI_DEBUG_LOGGING.md`.

## V1 First Milestone (Next Execution Target)
Current completed processing is AppsFlyer CSV. The next milestone remains: upload a Google Ads CSV, process it with streams, normalize campaigns/keywords, store metrics, detect `HIGH_SPEND_ZERO_CONVERSIONS`, and show the first insight in dashboard/questions.

## Epic 14 Status (Completed) — Explicit AI Analysis Runs & Controlled Questions
- Added `analysis_runs` as the explicit AI generation process separate from file imports, with QUEUED/RUNNING/COMPLETED/COMPLETED_WITH_WARNINGS/FAILED/SKIPPED lifecycle and provider/model audit metadata.
- API Writer can create manual AI analysis runs under generic `/projects/:id/analysis-runs` and publish `generate-ai-analysis` jobs on the `marketing-analysis` queue.
- Processor Worker consumes `marketing-analysis` jobs independently from import processing and generates facts-first recommendations/reports from bounded processed context only.
- AI outputs now link back to `analysis_run_id` and clearly mark mock output as `provider=mock`, `model=mock-local`, `generation_status=MOCKED`.
- API Reader exposes analysis run list/detail endpoints and controlled question endpoints under `/projects/:id/questions` plus `/projects/:id/ai-chat` compatibility.
- Controlled questions use deterministic intent routing and bounded data functions over facts, KPIs, semantic entities/relationships, context objects, recommendations, reports, and generic source filters; no Text-to-SQL or raw CSV access is introduced.

## Test UI Notes
- A framework-free HTML/JavaScript test UI lives at `apps/admin/src/assets/atlas-ai-test-ui.html`.
- When `apps/admin` is running, it is served from `/api/ui`; admin defaults to port `3002` so api-reader can keep `3000` and api-writer can keep `3001`.
- The UI stores endpoint/project config in browser localStorage and calls only generic multi-source Writer/Reader endpoints. Project selection is available through an explicit project selector card plus manual UUID input.
- The UI covers project setup, File Hub upload/list/detail/tag/process/reprocess/delete, AppsFlyer reader views, facts, recommendations, reports, analysis runs, process monitoring, controlled questions, and `/ai-chat` alias testing.
- File Hub cards surface profile/process metadata such as CSV row counts, classification confidence, checksum snippets, linked import IDs, and AppsFlyer event breakdowns when processed events are available.
- Recommendations and reports have readable card views in addition to raw JSON so AI outputs can be reviewed without manually parsing the API response.
- The test UI includes a `Monitoreo jobs` tab for polling raw file status, import flow, process runs, analysis run detail, and AI outputs linked to an `analysisRunId`.
