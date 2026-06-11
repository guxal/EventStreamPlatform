# marketing-shared

Shared contracts and types for the AI Marketing Copilot feature layer.

## Contains

- Base marketing enums and contracts such as `EntityType`, `FactType`, `Severity`, `DetectedFact`, `TemporalContext`, and `IAnalysisPlugin`.
- File Hub / Bronze Layer contracts for raw files, file tags, classification, profiles and processing states.
- AppsFlyer-specific source/report/event/KPI contracts.
- Semantic/context contracts for semantic entities, relationships and context objects.
- Process-audit contracts.
- AI analysis-run contracts including statuses, filters, job payloads and analysis types.

## Current architecture notes

- This library should stay dependency-light and framework-neutral where possible.
- Shared contracts must preserve the facts-first AI boundary: AI consumers receive detected facts and bounded processed context, not raw CSV payloads.
- Keep internal package scope as `@metrics-platform/*` during V1 for backward compatibility.
