# Utility commands and operational notes

## Serve apps

```bash
nx serve api-writer
nx serve api-reader
nx serve processor-worker
nx serve admin
```

Run several apps together when your Nx setup supports it:

```bash
nx run-many --target=serve --projects=api-writer,api-reader,processor-worker,admin --parallel
```

Default port convention:

- `api-reader`: `3000`
- `api-writer`: `3001`
- `admin`: `3002`
- test UI: `http://localhost:3002/api/ui`

## Infrastructure

```bash
docker-compose up -d
```

Current local compose focuses on PostgreSQL and Redis. Configure ClickHouse separately for full AppsFlyer processing unless a local ClickHouse service has been added.

## Nx maintenance

```bash
npx nx report
nx reset
nx graph
nx run-many --target=build --all
nx run-many --target=test --all
```

If serve/build fails with stale `dist` module errors:

```bash
rm -rf dist
nx reset
nx serve api-writer
```

## PostgreSQL migrations

Apply migrations in order when bootstrapping marketing data locally:

```bash
docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb < apps/processor-worker/src/database/migrations/004_create_marketing_core_tables.sql
docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb < apps/processor-worker/src/database/migrations/005_extend_raw_import_files_for_file_hub.sql
docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb < apps/processor-worker/src/database/migrations/006_extend_processing_status_and_errors.sql
docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb < apps/processor-worker/src/database/migrations/007_widen_data_imports_status.sql
docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb < apps/processor-worker/src/database/migrations/008_create_marketing_process_audit.sql
docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb < apps/processor-worker/src/database/migrations/009_extend_ai_outputs_provider_metadata.sql
docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb < apps/processor-worker/src/database/migrations/010_create_semantic_context_layer.sql
docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb < apps/processor-worker/src/database/migrations/011_create_analysis_runs.sql
```

## ClickHouse

Typical environment variables:

```bash
CLICKHOUSE_URL=https://<host>:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<password>
```

Use no-op/disabled ClickHouse modes only for local development. Worker processing should not silently complete without ClickHouse Silver/Gold writes in staging or production.

## File Hub manual operations

Reprocess a stuck/failed/completed File Hub file:

```http
POST /api/projects/{projectId}/files/{fileId}/reprocess
```

Normal processing trigger:

```http
POST /api/projects/{projectId}/files/{fileId}/process
```

Manual SQL reset if API reprocess is unavailable:

```sql
UPDATE raw_import_files
SET status = 'READY_TO_PROCESS', error_message = NULL, error_summary = NULL, error_stage = NULL
WHERE id = '<fileId>';

UPDATE data_imports
SET status = 'PENDING', error_message = NULL, error_stage = NULL, error_summary = NULL, finished_at = NULL
WHERE id = '<dataImportId>';
```

Then call the process endpoint.

## AI analysis runs

Create a manual analysis run:

```http
POST /api/projects/{projectId}/analysis-runs
Content-Type: application/json

{
  "source": "appsflyer",
  "analysisType": "FULL_REPORT",
  "importId": "<optional-import-id>",
  "provider": "mock"
}
```

Monitor through reader:

```http
GET /api/projects/{projectId}/analysis-runs
GET /api/projects/{projectId}/analysis-runs/{analysisRunId}
```

## Controlled questions / chat with IA

Preferred endpoint:

```http
POST /api/projects/{projectId}/questions
```

Compatibility endpoint:

```http
POST /api/projects/{projectId}/ai-chat
```

Questions must operate on processed facts/KPIs/semantic/context only. Do not use raw CSV or arbitrary SQL.

## Load test example

```bash
npx autocannon -c 100 -d 30 -p 10 http://localhost:3001/api/events \
  -m POST \
  -b '{"eventType":"TestType","userId":"test","timestamp":"2024-01-01T00:00:00Z","properties":{"score":1}}' \
  -H "Content-Type: application/json"
```
