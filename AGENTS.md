# AI Marketing Copilot — AGENTS Instructions

## Purpose
This file is the implementation guide and feedback memory for future AI/code agents working on this repository.

We are extending the existing EventStream Platform into an AI Marketing Copilot **without rebuilding from zero**.

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

## Required New Libraries (Planned)
- `libs/marketing-shared`
- `libs/marketing-application`
- `libs/marketing-infrastructure`
- `libs/marketing-plugins`

## PostgreSQL Tables (Planned)
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

## ClickHouse Tables (Planned)
- `marketing_daily_metrics`
- `marketing_metric_snapshots`

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

## V1 First Milestone (Execution Target)
Upload a Google Ads CSV, process it with streams, normalize campaigns, store metrics, detect `HIGH_SPEND_ZERO_CONVERSIONS`, and show first insight in dashboard.
