# AI Debug Logging

AI Marketing Copilot includes structured, safe debug logs for validating the facts-first AI flow:

`detected_facts / KPI snapshots / bounded context → prompt → provider → parser → persisted recommendations/reports/chat response`.

## Environment flags

| Flag                         | Default                   | Purpose                                                                                                                    |
| ---------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `AI_DEBUG_ENABLED`           | `false` outside local/dev | Enables structured AI debug events.                                                                                        |
| `AI_DEBUG_LOG_CONTEXT`       | `false`                   | Adds sanitized bounded context payloads to `AI_CONTEXT_BUILT` logs. Summary counts are still logged when debug is enabled. |
| `AI_DEBUG_LOG_PROMPTS`       | `false`                   | Adds sanitized prompt messages to `AI_PROMPT_BUILT` logs. Prompt text is never logged by default.                          |
| `AI_DEBUG_LOG_RESPONSES`     | `false`                   | Adds sanitized provider response text to `OPENAI_RESPONSE_RECEIVED` logs. Response text is never logged by default.        |
| `AI_DEBUG_LOG_PARSED_OUTPUT` | `false`                   | Adds sanitized parsed JSON/output payloads to `AI_RESPONSE_PARSED` logs.                                                   |
| `AI_DEBUG_MAX_CHARS`         | `12000`                   | Maximum characters retained for logged/persisted debug payload fragments. Longer content is truncated with `[TRUNCATED]`.  |
| `AI_DEBUG_PERSIST_TRACES`    | `false`                   | Persists sanitized trace rows in PostgreSQL `ai_debug_traces`.                                                             |

Production safety rule: leave prompt, response, parsed-output, and trace persistence flags disabled in production unless a short-lived incident-debug process explicitly approves them.

## What gets logged

When `AI_DEBUG_ENABLED=true`, the backend emits structured JSON logs for:

- `AI_CHAT_REQUEST_RECEIVED` and `AI_CHAT_RESPONSE_SENT`.
- `AI_CONTEXT_BUILT` with counts for facts, KPIs, warnings, limitations, and data availability such as `hasAppsflyer` and `hasGoogleAdsCost`.
- `AI_PROMPT_BUILT` with message counts and prompt character counts.
- `OPENAI_REQUEST_STARTED`, `OPENAI_RESPONSE_RECEIVED`, and `OPENAI_REQUEST_FAILED`.
- `AI_RESPONSE_PARSE_STARTED`, `AI_RESPONSE_PARSED`, and `AI_RESPONSE_PARSE_FAILED`.
- `AI_OUTPUT_PERSISTED` for recommendations and reports.
- `AI_SKIPPED` when AI generation is intentionally skipped or falls back.
- `AI_CONTEXT_REJECTED` when forbidden raw-data keys are detected before an OpenAI call.

All events include a `correlationId` when available. File processing uses the File Hub/BullMQ correlation ID; manual analysis runs use their job correlation ID; chat requests accept an optional `correlationId` and generate one when missing.

## What never gets logged

The debug logger sanitizes all logged and persisted payloads. It must not log:

- OpenAI API keys or other `sk-*` keys.
- Bearer tokens or authorization headers.
- Emails and detected phone numbers.
- Customer user IDs.
- Device/advertising identifiers such as IDFA, GAID, AppsFlyer IDs, advertising IDs, and device IDs.
- Raw CSV content, raw CSV rows, or full raw payloads.
- Large unbounded JSON blobs.

Forbidden raw-data keys are rejected before provider calls:

- `rawCsv`
- `rawRows`
- `rawPayload`
- `raw_payload`
- `sampleRows` when too large
- `fullCsvContent`
- `csvContent`

## Enable local debugging

For a full local/staging validation session:

```bash
AI_DEBUG_ENABLED=true
AI_DEBUG_LOG_CONTEXT=true
AI_DEBUG_LOG_PROMPTS=true
AI_DEBUG_LOG_RESPONSES=true
AI_DEBUG_LOG_PARSED_OUTPUT=true
AI_DEBUG_PERSIST_TRACES=true
AI_DEBUG_MAX_CHARS=12000
```

Then process an AppsFlyer file, generate an analysis run, and ask controlled questions such as:

- `Can we calculate ROAS?`
- `Why is Event Revenue empty?`

Expected debug evidence:

- Context logs show AppsFlyer data and `hasGoogleAdsCost=false` when no cost source exists.
- Prompt logs show only bounded facts/KPIs/context, not raw CSV.
- Response logs show the model response only when response logging is enabled.
- Parse logs show valid/invalid structured output.
- Persistence logs show saved recommendation/report IDs and item counts.
- ROAS answers explain that cost data from a reliable source is required.
- Event Revenue answers show whether `EVENT_REVENUE_EMPTY` and `EVENT_AMOUNT_IN_JSON` facts were included.

## Persistent traces

When `AI_DEBUG_PERSIST_TRACES=true`, sanitized traces are inserted into `ai_debug_traces` with:

- correlation and scope fields (`correlation_id`, `project_id`, `import_id`, `raw_file_id`, `source`, `report_type`)
- flow metadata (`ai_flow`, `prompt_type`, `model`)
- `context_summary`
- optional `sanitized_prompt`
- optional `sanitized_response`
- optional `parsed_output`
- error metadata
- duration and token usage

Example query:

```sql
SELECT created_at, event_scope.ai_flow, prompt_type, model, error_type, error_message
FROM (
  SELECT created_at, jsonb_build_object('ai_flow', ai_flow) AS event_scope, prompt_type, model, error_type, error_message
  FROM ai_debug_traces
  WHERE correlation_id = '<correlation-id>'
  ORDER BY created_at ASC
) traces;
```

Do not enable trace persistence for production traffic unless the sanitized trace table is included in the incident data-handling plan.

## Debug prompt issues

1. Find the correlation ID in `AI_CHAT_REQUEST_RECEIVED`, the File Hub process response, or the analysis-run queue response.
2. Search logs for `AI_CONTEXT_BUILT` with that correlation ID.
3. Verify counts and availability flags (`factsCount`, `kpisCount`, `hasGoogleAdsCost`, `hasRawCsv`).
4. Search for `AI_PROMPT_BUILT`.
5. If `AI_CONTEXT_REJECTED` appears, remove forbidden raw-data fields from the bounded context source before retrying.

## Debug OpenAI errors

Use `OPENAI_REQUEST_FAILED` fields:

- `errorType=timeout`: increase `AI_TIMEOUT_MS` or retry later.
- `errorType=rate_limit`: reduce concurrency or retry later.
- `errorType=invalid_api_key`: rotate/fix `OPENAI_API_KEY`; the key value is never logged.
- `errorType=model_not_found`: verify `AI_MODEL`.
- `errorType=network`: inspect outbound connectivity.

Import processing should keep facts/KPIs when AI fails; AI output status is skipped/failed with error metadata instead of treating raw processing as failed unless `AI_REQUIRED=true`.

## Debug invalid JSON responses

For JSON-producing flows, inspect:

- `AI_RESPONSE_PARSE_STARTED`
- `AI_RESPONSE_PARSE_FAILED`
- sanitized `responsePreview`

Invalid JSON should not crash normal non-required AI flows. The system falls back to deterministic outputs or stores a skipped/error state so detected facts remain available.

## Production safety rules

- Keep `AI_DEBUG_LOG_PROMPTS=false`, `AI_DEBUG_LOG_RESPONSES=false`, `AI_DEBUG_LOG_PARSED_OUTPUT=false`, and `AI_DEBUG_PERSIST_TRACES=false` by default.
- Never add API keys, headers, raw CSV, or raw payloads to AI metadata.
- Keep AI context facts-first and bounded.
- Treat `ai_debug_traces` as debug-only data and apply retention controls before using it outside local/staging.
