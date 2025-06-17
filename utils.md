

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