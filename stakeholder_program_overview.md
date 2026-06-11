# AI Marketing Copilot — Stakeholder Program Overview

## 1. Executive summary

The EventStream Platform now includes an AI Marketing Copilot layer that converts marketing CSV uploads into processed metrics, deterministic findings, AI-generated recommendations/reports, and controlled AI chat answers.

The current strongest production-like flow is the AppsFlyer CSV path, backed by File Hub, queue-based processing, ClickHouse, PostgreSQL, semantic/context enrichment, AI providers and a browser-based HTML test UI.

## 2. Business value delivered

- Faster campaign and traffic-quality diagnostics from uploaded marketing data.
- Safer AI outputs because recommendations and reports are grounded in detected facts and bounded processed context.
- Better auditability through process runs, process steps, import statuses, provider/model metadata and analysis runs.
- Better product validation via a lightweight `/api/ui` test interface before building a full frontend.
- Foundation for future multi-source analytics across AppsFlyer, Google Ads, Meta Ads and other marketing channels.

## 3. Delivered capabilities

### Data ingestion and processing

- Project lifecycle APIs.
- File Hub upload, profiling, classification, manual tagging, process/reprocess and delete.
- AppsFlyer stream processing from object storage.
- ClickHouse storage for normalized events and KPI snapshots.
- PostgreSQL persistence for facts and operational records.

### Intelligence and AI

- Deterministic detected facts.
- AI recommendations and reports generated from facts only.
- Semantic entities/relationships and context objects for better grounding.
- Explicit AI analysis runs that can be triggered independently from file imports.
- Controlled questions/chat with intent routing and bounded data access.

### Observability and validation

- Process audit tables for stage-level observability.
- Status/error summaries on raw files and imports.
- Analysis-run list/detail reader endpoints.
- HTML/JavaScript test UI served by the admin app.

## 4. Current user-facing flow

1. Create/select a project.
2. Upload an AppsFlyer CSV in File Hub.
3. Review automatic classification and manually tag if needed.
4. Trigger processing.
5. Monitor raw file, import flow and process-run status.
6. Review facts, recommendations and reports.
7. Trigger a manual AI analysis run when needed.
8. Ask controlled questions through `/questions` or the `/ai-chat` compatibility endpoint.

## 5. Guardrails

- Raw CSV is never analyzed directly by AI.
- AI must not invent metrics, trends or profitability claims.
- Controlled chat does not expose Text-to-SQL.
- AppsFlyer-only data cannot be used to claim ROAS, CPA, CAC or profitability without a trusted cost source.

## 6. Remaining program risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Google Ads CSV processing is not implemented yet | Original V1 Google Ads milestone is not complete | Prioritize Google Ads File Hub parser/normalizer/fact generation next. |
| Cost metrics lack a trusted source | ROI/profitability questions must be limited | Add Google Ads/Meta spend adapters or another trusted cost-source integration. |
| Local infra lacks a full one-command data stack | Slower onboarding and QA | Add ClickHouse and MinIO/S3 to local compose or document cloud/local profiles clearly. |
| AI provider observability is partial | Harder cost/latency governance | Add prompt versions, token/cost estimates and latency records. |

## 7. Recommended next milestone

Deliver a Google Ads CSV processing slice that uses the existing File Hub and AI guardrails:

Upload Google Ads CSV → stream parse → normalize campaign/keyword metrics → write ClickHouse metrics → generate deterministic facts such as `HIGH_SPEND_ZERO_CONVERSIONS` → run AI analysis → show insight in dashboard and controlled questions.
