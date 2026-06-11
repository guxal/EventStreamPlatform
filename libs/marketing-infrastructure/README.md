# marketing-infrastructure

Infrastructure adapters and repositories for AI Marketing Copilot.

## Contains

- Object storage adapter used by File Hub and worker processing.
- PostgreSQL repositories for projects, raw import files, data imports, facts, recommendations, reports, process audit, semantic entities, semantic relationships, context objects and analysis runs.
- ClickHouse repositories for marketing events, AppsFlyer reader views and metric snapshots.
- Reader repositories that expose bounded data to API Reader and AI question services.

## Current storage split

- PostgreSQL stores transactional records, statuses, audit, AI outputs and semantic/context data.
- ClickHouse stores time-series and aggregate marketing metrics/events.
- Raw CSV files remain in object storage and must not be used directly by AI providers.
