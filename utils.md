

nx serve api-writer


nx run-many --target=serve --projects=api-writer,api-reader,processor-worker --parallel



docker-compose up -d


npx nx report

nx reset

nx graph

nx run-many --target=serve --all

nx run-many --target=build --all

nx typecheck core-domain

nx build core-domain

nx e2e api-writer-e2e

npx autocannon -c 100 -d 30 -p 10 http://localhost:3001/api/events \
  -m POST \
  -b '{"eventType":"TestType","userId":"test","timestamp":"2024-01-01T00:00:00Z","properties":{"score":1}}' \
  -H "Content-Type: application/json"


npx ts-node ./faker/generate-fake-events.ts


// run migrations filehub
docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb \
  < apps/processor-worker/src/database/migrations/004_create_marketing_core_tables.sql

docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb \
  < apps/processor-worker/src/database/migrations/005_extend_raw_import_files_for_file_hub.sql

docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb \
  < apps/processor-worker/src/database/migrations/006_extend_processing_status_and_errors.sql

docker exec -i metrics-platform-postgres-1 psql -U metrics -d metricsdb \
  < apps/processor-worker/src/database/migrations/007_widen_data_imports_status.sql

// reprocess a stuck File Hub file (Swagger)
// POST /api/projects/{projectId}/files/{fileId}/reprocess

// manual SQL reset + process (if API not deployed yet)
// UPDATE raw_import_files SET status='READY_TO_PROCESS', error_message=NULL, error_summary=NULL, error_stage=NULL WHERE id='<fileId>';
// UPDATE data_imports SET status='PENDING', error_message=NULL, error_stage=NULL, error_summary=NULL, finished_at=NULL WHERE id='<dataImportId>';
// then POST /api/projects/{projectId}/files/{fileId}/process