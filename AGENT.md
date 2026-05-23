# AI Marketing Copilot — Agent Instructions

## Purpose
This file is the implementation guide and feedback memory for future AI/code agents working on this repository.

We are extending the existing EventStream Platform into an AI Marketing Copilot **without rebuilding from zero**.

## Epic 0 Status (Completed)
- E0-1: Architecture target confirmed: extend existing EventStream core.
- E0-2: Metrics storage selected: **ClickHouse** for V1.
- E0-3: This `AGENT.md` created as persistent implementation guide.
- E0-4: Naming convention defined to avoid platform-name drift.

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
