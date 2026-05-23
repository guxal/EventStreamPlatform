# EventStream AI Marketing Copilot — Executive Program Overview

## 1) Program Summary
EventStream Platform is being extended with an **AI Marketing Copilot** to help teams ingest marketing CSV data, detect performance issues, and generate actionable recommendations/reports.

This is being delivered as a phased program over the existing platform (no core rewrite).

## 2) Business Goals
- Reduce time-to-insight for campaign optimization.
- Standardize KPI diagnostics with deterministic rules.
- Introduce controlled AI outputs grounded in verified facts.
- Prepare a scalable data foundation for future channel integrations.

## 3) What has been delivered
- New API capabilities for project/import lifecycle and reader dashboards.
- Queue-based import orchestration (`marketing-imports`).
- Object storage write step prior to async processing.
- PostgreSQL schema for operational/transactional entities.
- ClickHouse schema for time-series marketing metrics.
- Deterministic analysis engine with 8 V1 diagnostic rules.
- AI layer that generates recommendations/reports from detected facts.

## 4) Current End-to-End Flow (V1 implemented scaffold)
1. User creates project and uploads CSV metadata/payload.
2. Writer stores file to object storage adapter.
3. Writer emits `process-marketing-import` job to BullMQ.
4. Worker pipeline is prepared for parser/normalizer/analysis stages.
5. Reader endpoints expose dashboard/facts/recommendations/reports.
6. AI chat endpoint returns controlled facts-first response scaffold.

## 5) Scope boundaries (V1)
### Included
- CSV-based ingestion model.
- Deterministic rule-based fact generation.
- Facts-first AI recommendation/report generation.
- Programmatic API access for dashboard and insights.

### Not included yet
- Direct Google Ads / Meta Ads API live integrations.
- Full production persistence wiring for all reader/writer handlers.
- Autonomous optimization loops.

## 6) Program Status by Epic
- Epic 0–4: Foundation, architecture, schema, and API scaffolding complete.
- Epic 5: Import storage + queue publication complete.
- Epic 6: Defensive AI services complete.
- Epic 7: Analysis engine and V1 rules complete.
- Epic 8: AI output orchestration and persistence abstraction complete.
- Epic 9: Reader API surface complete.

## 7) Risks and Mitigations
- **Risk:** Some flows are currently scaffolded with in-memory implementations.
  - **Mitigation:** Replace with repository-backed persistence in next execution wave.
- **Risk:** Storage adapter is local filesystem in current implementation.
  - **Mitigation:** Swap adapter with S3/MinIO provider without changing API contracts.
- **Risk:** Worker runtime integration not fully E2E wired yet.
  - **Mitigation:** Prioritize parser/normalizer/ClickHouse write + fact persistence sprint.

## 8) Next Execution Wave (recommended)
1. Replace in-memory writer/reader stores with DB repositories.
2. Implement streaming CSV parser + normalization in worker.
3. Wire metrics writes into ClickHouse and facts into PostgreSQL.
4. Connect AI orchestrator to persisted facts/recommendations/reports.
5. Add integration and e2e tests across upload-to-insight flow.

## 9) Success Criteria for Stakeholders
- Upload a marketing CSV and track import status.
- View normalized campaign/keyword-level insights.
- See deterministic detected facts for key performance issues.
- Receive generated recommendations and AI summary report.
- Ask controlled questions via AI chat over project facts.
