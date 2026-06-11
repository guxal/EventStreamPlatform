# EventStream Platform + AI Marketing Copilot

EventStream Platform is a NestJS + Nx monorepo for event ingestion, async processing, analytics, and reader APIs. The repository now includes the **AI Marketing Copilot** feature layer, which extends the existing EventStream core instead of replacing it.

## Current status

The current functional marketing slice is centered on **File Hub → AppsFlyer Medallion Processing → semantic/context enrichment → facts-first AI outputs → controlled AI questions/chat**.

Implemented capabilities include:

- Project creation and persisted marketing project metadata.
- File Hub / Bronze Layer CSV upload endpoints for raw files.
- Object-storage-backed raw CSV storage with stream profiling and deterministic source/report classification.
- Manual tagging, processing trigger, reprocess, delete, list, and detail endpoints for raw files.
- BullMQ import processing on the `marketing-imports` queue using `process-marketing-import` jobs.
- AppsFlyer stream processing from object storage into normalized ClickHouse Silver events.
- AppsFlyer KPI snapshots and deterministic fact generation.
- PostgreSQL persistence for facts, recommendations, AI reports, semantic entities, semantic relationships, context objects, process audit, and analysis runs.
- Explicit manual AI analysis runs published on the `marketing-analysis` queue using `generate-ai-analysis` jobs.
- Provider-backed or deterministic-fallback AI recommendations/reports using facts-first bounded context.
- Controlled question answering and `/ai-chat` compatibility over processed data only.
- Framework-free HTML/JavaScript test UI served by the admin app at `/api/ui`.

## Repository layout

### Core platform

- `apps/api-writer` — event ingestion, project lifecycle, File Hub, import trigger, and analysis-run creation APIs.
- `apps/api-reader` — metrics, AppsFlyer reader views, facts, recommendations, reports, semantic/context data, process audit, analysis runs, and controlled questions/chat.
- `apps/processor-worker` — import and AI-analysis queue consumers plus database migrations.
- `apps/admin` — admin API and static test UI asset serving.
- `libs/core-*` — shared core domain/application/infrastructure modules.

### Marketing Copilot layer

- `libs/marketing-shared` — contracts, enums, File Hub/Appsflyer/Semantic/AI analysis-run types.
- `libs/marketing-plugins` — deterministic analysis rules and AppsFlyer parsing/normalization/KPI/fact plugins.
- `libs/marketing-application` — File Hub orchestration, AI provider abstraction, AI output generation, semantic/context builders, analysis-run runner, and controlled question services.
- `libs/marketing-infrastructure` — PostgreSQL repositories, ClickHouse repositories, object storage adapter, process audit, semantic/context repositories, and AI output repositories.

## Main API surfaces

### Writer API

- `POST /projects`
- `GET /projects`
- `POST /projects/:id/files`
- `GET /projects/:id/files`
- `GET /projects/:id/files/:fileId`
- `PATCH /projects/:id/files/:fileId/tags`
- `POST /projects/:id/files/:fileId/process`
- `POST /projects/:id/files/:fileId/reprocess`
- `DELETE /projects/:id/files/:fileId`
- `POST /projects/:id/analysis-runs`
- Legacy compatibility: `POST /projects/:id/imports/csv`, `GET /projects/:id/imports`

### Reader API

- `GET /projects/:id/dashboard`
- `GET /projects/:id/overview`
- `GET /projects/:id/metrics`
- `GET /projects/:id/entities/performance`
- `GET /projects/:id/events/by-name`
- `GET /projects/:id/appsflyer/*`
- `GET /projects/:id/facts`
- `GET /projects/:id/recommendations`
- `GET /projects/:id/reports`
- `GET /projects/:id/semantic/entities`
- `GET /projects/:id/semantic/relationships`
- `GET /projects/:id/context`
- `GET /projects/:id/analysis-runs`
- `GET /projects/:id/analysis-runs/:analysisRunId`
- `GET /projects/:id/processes`
- `GET /projects/:id/imports/:importId/flow`
- `POST /projects/:id/questions`
- Compatibility alias: `POST /projects/:id/ai-chat`

## Test UI

A framework-free test UI is available at:

- Source file: `apps/admin/src/assets/atlas-ai-test-ui.html`
- Served route when `apps/admin` is running: `/api/ui`
- Default admin port: `3002`

The UI stores endpoint/project settings in browser `localStorage` and exercises generic multi-source flows: File Hub upload/tag/process/reprocess, monitoring, analysis runs, AI outputs, controlled questions, and `/ai-chat` compatibility.

## Technical documentation

- `AGENTS.md` — canonical implementation guide and persistent memory for AI/code agents.
- `docs_marketing_copilot.md` — deep technical architecture and current flow.
- `docs/architecture/file-hub-bronze-layer.md` — File Hub / Bronze Layer behavior.
- `docs/architecture/appsflyer-medallion-implementation-notes.md` — AppsFlyer Bronze/Silver/Gold implementation notes.
- `docs/analisis-proyecto-conclusiones-recomendaciones.md` — current technical assessment, risks, and recommendations.
- `marketing_copilot_project_overview.md` — project-level implementation overview.
- `stakeholder_program_overview.md` — business/stakeholder summary.
- `utils.md` — local commands and operational snippets.

## Quick start

1. Install dependencies: `npm install`
2. Start infra: `docker-compose up -d`
3. Apply PostgreSQL migrations under `apps/processor-worker/src/database/migrations/`.
4. Configure ClickHouse for AppsFlyer processing if running the full pipeline.
5. Serve apps with Nx as needed, typically `api-writer`, `api-reader`, `processor-worker`, and `admin`.

## Important boundaries

- AI must use detected facts and bounded processed context only; raw CSV is never sent to AI providers.
- Controlled questions/chat must use intent routing and bounded data functions; no open Text-to-SQL.
- AppsFlyer alone is not a reliable cost source in V1, so ROAS/CPA/CAC/profitability claims must be marked unavailable unless a trusted cost source is added.
- Google Ads and Meta Ads direct/API processing are future integrations; the current production-like processing path is AppsFlyer CSV through File Hub.
