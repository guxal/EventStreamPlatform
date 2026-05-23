# EventStream Platform + AI Marketing Copilot

EventStream is a modular platform for event ingestion, processing, and analytics.
This repository now includes an **AI Marketing Copilot V1 scaffold** built on top of the existing core.

## What’s in this repository

### Core platform
- `apps/api-writer` — event ingestion and writer APIs
- `apps/api-reader` — metric/query and reader APIs
- `apps/processor-worker` — async/cron processing
- `libs/core-*` — shared/core application + infrastructure

### Marketing Copilot layer (V1)
- `libs/marketing-shared` — contracts, enums, types
- `libs/marketing-plugins` — deterministic analysis engine + V1 rules
- `libs/marketing-application` — defensive AI services and orchestration
- `libs/marketing-infrastructure` — repositories + object storage adapter

## Current implemented capabilities
- Project/import APIs in writer.
- Reader endpoints for dashboard/campaigns/keywords/facts/recommendations/reports/ai-chat.
- Dedicated `marketing-imports` queue and import job publication.
- Object storage write step before queue publication.
- PostgreSQL migration for transactional marketing schema.
- ClickHouse migration for marketing time-series metrics.

## Technical docs
- `AGENTS.md` — canonical technical guidance for AI/code agents.
- `docs_marketing_copilot.md` — deep technical architecture and flow.
- `stakeholder_program_overview.md` — high-level stakeholder program summary.

## Quick start
1. Install dependencies: `npm install`
2. Start infra: `docker-compose up -d`
3. Serve apps with Nx as needed.

## Notes
Some flows are currently scaffolded (in-memory stores / adapter abstractions) and are ready for persistence/runtime wiring in the next execution wave.
