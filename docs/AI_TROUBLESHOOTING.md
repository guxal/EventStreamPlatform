# AI Marketing Copilot V1 — Troubleshooting

## Missing OpenAI API key

Set `AI_PROVIDER=openai` and `OPENAI_API_KEY`. If `AI_REQUIRED=false`, the system can use mock/deterministic fallback and keep facts/KPIs available.

## Invalid API key

OpenAI returns an error and the provider raises `AI_PROVIDER_REQUEST_FAILED`. Check output `generation_status`, `error_message`, and provider logs. Do not log the key.

## Model not found

Verify `AI_MODEL`. Default is `gpt-4o-mini`. Model errors should skip/fail AI output generation without deleting processed metrics/facts.

## Rate limit

HTTP 429 is retried according to `AI_MAX_RETRIES`. If retries fail, AI generation is skipped/fallback unless required.

## Timeout

Configure `AI_TIMEOUT_MS`. Timeout/network errors are retried when retryable.

## Invalid JSON from model

Recommendation generation expects JSON. Invalid JSON raises `AI_OUTPUT_PARSE_ERROR` and falls back to deterministic fact recommendations unless `AI_REQUIRED=true`.

## Empty facts

Recommendations are skipped when no facts exist. Reports should state insufficient data.

## Empty KPIs

Reports/chat may still explain facts, but must state KPI limitations.

## Prompt too large

Context builder bounds facts/entities/relationships/context objects and truncates large objects. Reduce filters by import, source, report type, or date.

## No reliable cost source

ROAS, CPA, CAC, profitability, and cost efficiency cannot be answered. Upload Google Ads, Meta Ads, or another reliable cost source.

## AppsFlyer Event Revenue empty

If `EVENT_AMOUNT_IN_JSON` exists, monetary event analysis can use `Event Value.amount`; otherwise monetary analysis is insufficient.

## AI outputs duplicated

AI import flow uses replace-by-scope for project/import/source/report type. If duplicates remain, verify `import_id`, `source`, and `report_type` are populated on `recommendations` and `ai_reports`.

## AI report not generated

Check facts/KPIs/context availability, provider configuration, `AI_REQUIRED`, and `generation_status`/`error_message`.

## AI chat answering unsupported metrics

Verify the question routes to `UNAVAILABLE_METRICS` for ROAS/CPA/CAC/cost/profitability, and that `unavailableMetrics` includes cost limitations.
