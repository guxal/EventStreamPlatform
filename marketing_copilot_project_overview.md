# AI Marketing Copilot — Project Overview

## 1. Product direction

AI Marketing Copilot is a feature layer inside EventStream Platform. It turns uploaded marketing CSV data into normalized events/KPIs, deterministic detected facts, semantic/context objects, AI recommendations/reports, and controlled AI answers.

The implementation intentionally extends the existing EventStream core instead of rebuilding ingestion, queues, workers, or reader APIs from scratch.

## 2. Current implementation snapshot

The current backend is strongest for the **AppsFlyer CSV** path:

1. User creates a project.
2. User uploads a CSV into File Hub.
3. File Hub stores the raw object and profiles/classifies the stream.
4. User manually tags the file if classification confidence is insufficient.
5. User triggers processing only once the raw file is `READY_TO_PROCESS`.
6. `processor-worker` reads the object stream and runs the AppsFlyer pipeline.
7. Normalized events are written to ClickHouse.
8. KPI snapshots and deterministic facts are generated.
9. Facts are persisted in PostgreSQL.
10. Semantic entities, relationships and context objects are optionally built.
11. AI recommendations/reports are generated from facts and bounded context.
12. Reader APIs and controlled questions/chat expose the results.

## 3. Completed capability areas

### EventStream core extension

- Existing NestJS + Nx app structure preserved.
- Existing core event ingestion retained.
- Marketing capabilities isolated under `libs/marketing-*` and marketing-specific app endpoints.

### File Hub / Bronze Layer

- Raw CSV upload endpoint.
- Object storage write before processing.
- Stream profiling and deterministic report classification.
- Status lifecycle for upload/profile/review/process/completion/failure.
- Manual tags for source/report type.
- Process, reprocess, delete, list and detail actions.

### AppsFlyer Medallion processing

- Queue-driven AppsFlyer worker path.
- Object-stream CSV parsing.
- Column mapping, event value parsing, normalization and row hashing.
- ClickHouse `marketing.marketing_events` Silver table.
- ClickHouse metric snapshots for Gold KPI summaries.
- AppsFlyer deterministic facts.
- Audit/error status across Bronze, Silver, Gold, semantic/context and AI phases.

### Semantic & Context Layer

- PostgreSQL semantic entities.
- PostgreSQL semantic relationships.
- PostgreSQL context objects.
- Fact enrichment links to semantic/context objects.
- Bounded AI context builder that excludes raw CSV and includes warnings/unavailable metrics.

### AI outputs and providers

- Defensive system prompt.
- Mock, OpenAI, Claude and Gemini provider abstractions.
- Recommendation/report generation from facts and bounded context.
- Provider/model/prompt metadata stored with AI outputs.
- Deterministic fallback when AI provider calls are optional and fail.

### Explicit AI analysis runs

- `analysis_runs` lifecycle separate from imports.
- Writer endpoint to create manual runs.
- `marketing-analysis` queue and `generate-ai-analysis` job.
- Worker processor for manual AI analysis.
- AI outputs linked back to `analysis_run_id`.

### Controlled questions / chat with IA

- Reader endpoint `POST /projects/:id/questions`.
- Compatibility alias `POST /projects/:id/ai-chat`.
- Intent routing instead of open Text-to-SQL.
- Controlled data functions over processed facts/KPIs/semantic/context/recommendations/reports.
- Provider-backed answer generation with deterministic fallback.

### HTML test UI

- `apps/admin/src/assets/atlas-ai-test-ui.html`.
- Served from `/api/ui` by `apps/admin`.
- Supports File Hub testing, monitoring, analysis runs, AI outputs, controlled questions and `/ai-chat` alias.

## 4. Implemented epics

- Epic 0: architecture target and naming convention.
- Epic 1: marketing libraries and base contracts.
- Epic 2: PostgreSQL marketing schema.
- Epic 3: ClickHouse marketing metrics schema.
- Epic 5: raw import storage metadata and queue publication.
- Epic 6: facts-first AI foundation.
- Epic 7: deterministic analysis rules.
- Epic 8: AI output orchestration and persistence.
- Epic 9: reader endpoints.
- Epic 10: File Hub / Bronze Layer.
- Epic 11: AppsFlyer Medallion processing.
- Epic 12: semantic/context layer.
- Epic 13: process audit and AI provider metadata.
- Epic 14: explicit AI analysis runs and controlled questions/chat.

## 5. Current boundaries

- Google Ads and Meta Ads direct/API integrations are not implemented.
- Google Ads CSV processing remains a future milestone.
- AppsFlyer alone must not be treated as a reliable cost source for ROAS/CPA/CAC.
- Controlled questions/chat must not access raw CSV or generate arbitrary SQL.
- ClickHouse must be configured for real worker processing; no-op ClickHouse modes are useful only for local development.

## 6. Next recommended roadmap

1. Implement Google Ads CSV processing through the File Hub.
2. Add a trusted cost-source adapter for cross-channel ROI metrics.
3. Harden local/staging infrastructure with ClickHouse and object storage defaults.
4. Add E2E tests for upload → process → facts → analysis runs → questions.
5. Add AI provider observability for prompt versions, token/cost estimates and latency.
6. Continue improving the HTML test UI while avoiding a heavyweight frontend dependency until product flows stabilize.
