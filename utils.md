

nx serve api-writer


nx run-many --target=serve --projects=api-writer,api-reader,processor-worker --parallel



docker-compose up -d


npx nx report

nx reset

nx graph

nx run-many --target=serve --all

nx typecheck core-domain

nx build core-domain

