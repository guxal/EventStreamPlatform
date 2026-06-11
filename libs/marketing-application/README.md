# marketing-application

Application services for AI Marketing Copilot.

## Main responsibilities

- File Hub orchestration through upload/profile/classify/tag/process/reprocess/delete flows.
- AI provider abstraction and provider factory for mock, OpenAI, Claude and Gemini.
- Facts-first recommendation and report generation.
- AI output orchestration with provider/model metadata and deterministic fallback behavior.
- Semantic/context builders for AI grounding.
- `AiContextBuilderService` for bounded context, redaction and unavailable metric warnings.
- `AiAnalysisRunnerService` for explicit manual analysis runs from the `marketing-analysis` queue.
- Controlled question services for `/questions` and `/ai-chat` compatibility.

## Guardrails

- Never pass raw CSV content directly to AI providers.
- Use facts, KPIs, semantic/context objects and explicit warnings as the AI input boundary.
- Preserve insufficient-data/unavailable-metrics behavior.
- Do not instantiate concrete AI providers in feature code when the factory/orchestrator can be used.
