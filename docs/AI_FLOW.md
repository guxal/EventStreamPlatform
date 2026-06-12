# AI Marketing Copilot V1 — AI Flow

## 1. Architecture overview

The AI layer is a facts-first layer on top of EventStream Platform. It does not replace the File Hub, AppsFlyer processing pipeline, ClickHouse metrics, PostgreSQL facts, or controlled question APIs.

Canonical flow:

```text
processed AppsFlyer data
→ ClickHouse events / KPI snapshots
→ PostgreSQL detected_facts
→ AiContextBuilderService bounded context
→ defensive prompts
→ AI provider or deterministic fallback
→ recommendations / ai_reports / question response
```

AI is allowed to explain and recommend only from persisted processed data: detected facts, KPIs, metric snapshots, semantic/context records, warnings, and explicit limitations.

## 2. Services involved

- `AiContextBuilderService`: filters facts by source/report/import/entity, redacts raw/CSV/device/payload fields, bounds arrays, and adds data availability plus limitations.
- `RecommendationGeneratorService`: asks the selected provider for structured JSON recommendations and falls back to deterministic recommendations from facts.
- `ReportGeneratorService`: generates markdown reports from bounded context and falls back to deterministic reports.
- `AiOutputOrchestratorService`: builds context, calls generators, replaces previous import-scoped AI outputs, and persists recommendations/reports.
- `AiAnalysisRunnerService`: explicit queued analysis-run path independent from imports.
- `AiQuestionAnsweringService`: controlled chat/questions path using routed intents and bounded data functions.
- Provider factory/providers: selects OpenAI, Claude, Gemini, or mock fallback.

## 3. How detected_facts become recommendations

1. Worker or analysis runner loads generated `detected_facts`.
2. Context builder creates compact context with facts, KPI extras, warnings, semantic entities, relationships, and context objects.
3. Recommendation prompt requests valid JSON only.
4. Parser validates the top-level `recommendations` array.
5. Invalid JSON or provider failure falls back to deterministic fact-based recommendations unless `AI_REQUIRED=true`.
6. Persistence replaces previous recommendations for the same project/import/source/report type before insert.

Every recommendation must include fact references, severity/priority, limitations, confidence, and suggested actions.

## 4. How detected_facts become reports

Reports use the same bounded context. The report prompt requires sections for executive summary, data sources, report types, KPIs, detected issues, recommendations, limitations, and next actions. If the provider fails, the deterministic report still states facts and unavailable metrics.

Report persistence replaces previous reports for the same project/import/source/report type before insert.

## 5. How AI chat works

`POST /projects/:id/questions` is preferred. `POST /projects/:id/ai-chat` is a compatibility alias.

Flow:

1. Receive a question.
2. Route intent deterministically.
3. Load bounded data through controlled functions only.
4. Build a defensive provider prompt.
5. Call provider or return deterministic fallback if unavailable/failing.
6. Return answer, intent, used-data counts, limitations, provider/model, and generation status.

No raw CSV, Text-to-SQL, or unbounded raw events are exposed to the model.

## 6. Data AI may use

- `detected_facts`
- ClickHouse KPI summaries / metric snapshots
- Aggregated AppsFlyer overview/media/campaign/event summaries
- Recommendations/reports already persisted
- Semantic entities/relationships
- Context objects
- Data quality warnings
- Explicit unavailable metrics and limitations

## 7. Data AI may not use

- Raw CSV rows or original file contents
- Full raw payload blobs
- Unbounded event lists
- Sensitive user/device identifiers
- Unsupported calculated metrics
- Cost/ROAS/profitability claims without a reliable cost source

## 8. OpenAI config env vars

- `AI_PROVIDER=openai`
- `OPENAI_API_KEY`
- `AI_MODEL` (default `gpt-4o-mini`)
- `AI_MAX_TOKENS` (default `1200`)
- `AI_TIMEOUT_MS` (default `30000`)
- `AI_MAX_RETRIES` (default `2`)
- `AI_REQUIRED=true|false`
- `AI_ENABLE_MOCK=true|false`
- `AI_DEBUG_LOG_PROMPTS=true|false` (reserved for sanitized local prompt debugging; do not log raw CSV or secrets)

## 9. Error handling

- Missing key: provider factory uses mock fallback unless AI is required or mock is disabled.
- Invalid key/model/rate limit/server error: provider raises `AiProviderError`; import processing keeps processed facts/KPIs and records skipped/fallback AI output when possible.
- Invalid JSON: `generateJson` raises `AI_OUTPUT_PARSE_ERROR`; recommendation generation falls back unless `AI_REQUIRED=true`.
- Network timeout/error: retried for retryable failures, then handled as provider failure.

## 10. Idempotency rules

V1 preferred behavior is replace-by-scope:

```text
project_id + import_id + source + report_type
```

The import orchestrator deletes scoped recommendations and reports before recreating them. AppsFlyer fact persistence also deletes existing facts for the same import/source/report/raw-file scope before saving newly generated facts.

## 11. Prompt templates

See `docs/AI_PROMPTS.md` for the defensive system prompt, recommendation JSON prompt, report prompt, and chat prompt rules.

## 12. Supported question examples

- What happened with this import?
- Which media source had the strongest processed event evidence?
- Can we calculate ROAS?
- Why are deposits low?
- What are the main issues?
- What recommendations should we take?
- What data is missing?
- Why is AppsFlyer Event Revenue empty?

## 13. Unsupported question examples

- Calculate ROAS without cost data.
- Is this campaign profitable with only AppsFlyer data?
- Read the original CSV and find patterns.
- Give user-level/device-level analysis.
- Infer install-to-FTD when the denominator is missing.

## 14. AppsFlyer-specific limitations

AppsFlyer V1 is not treated as a reliable ad-cost source. If only AppsFlyer exists, the AI must say ROAS/CPA/CAC/profitability require Google Ads, Meta Ads, or another reliable cost source. If `EVENT_REVENUE_EMPTY` and `EVENT_AMOUNT_IN_JSON` are both present, monetary event analysis is based on `Event Value.amount`, not Event Revenue.

Supported AppsFlyer fact types include `DATA_EXPORT_LIMIT_REACHED`, `EMPTY_REPORT`, `EVENT_REVENUE_EMPTY`, `EVENT_AMOUNT_IN_JSON`, `HIGH_BLOCKED_TRAFFIC_RATE`, `HIGH_BLOCKED_IN_APP_EVENTS`, `NO_RELIABLE_COST_SOURCE`, `LOW_INSTALL_TO_REGISTER`, `LOW_INSTALL_TO_DEPOSIT`, `LOW_INSTALL_TO_FTD`, `MEDIA_SOURCE_QUALITY_DIFFERENCE`, and `NOISY_EVENT_DISTRIBUTION`.

## 15. Troubleshooting checklist

1. Confirm file import completed.
2. Confirm ClickHouse metric snapshots exist.
3. Confirm `detected_facts` exist for the import.
4. Confirm AI context has facts/KPIs and no raw fields.
5. Confirm provider env vars.
6. Check `generation_status`, `error_message`, provider, and model on AI outputs.
7. Re-run import and confirm scoped outputs were replaced, not duplicated.
