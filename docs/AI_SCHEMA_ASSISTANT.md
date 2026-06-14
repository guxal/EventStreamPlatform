# AI Schema Assistant

The AI Schema Assistant helps map CSV schemas to canonical marketing fields. It only assists schema/mapping review; it must not analyze performance, compare campaigns, infer business results, or recommend optimizations from sample rows.

## Data sent

The assistant receives file metadata, headers, row count, classification confidence, source/report type, and at most 3-5 sanitized sample rows. Column names are preserved. Safe values are truncated and represented as examples/non-empty indicators.

## Data not sent

Raw sensitive values are not sent. IPs, Advertising IDs, AppsFlyer IDs, Customer User IDs, Android IDs, IDFA/IDFV/IMEI, Original URL, User Agent, emails, phones, tokens, and raw identifiers are redacted.

## Prompt behavior

The prompt instructs the assistant to return JSON only, map client CSV columns to canonical fields, identify sensitive fields and missing critical fields, suggest identity strategy, and suggest currency/timezone candidates. If unsure it must return `mapping_review_required`.

## Expected output

The response includes `confidence`, `recommendedAction`, `columnMapping`, `eventMapping`, `identityStrategy`, `currencyCandidates`, `timezoneCandidates`, `sensitiveFields`, `criticalColumns`, `dataQualityWarnings`, and `questionsForUser`.

## Review workflow

1. Run `POST /projects/:id/files/:fileId/schema/analyze` with `{ "useAi": true }` or run `schema/suggest`.
2. Review the AI-suggested mapping.
3. Correct fields if needed via `PATCH /projects/:id/mappings/:mappingId`.
4. Confirm via `POST /projects/:id/mappings/:mappingId/confirm`.
5. Apply to file via `POST /projects/:id/files/:fileId/mapping/:mappingId/apply`.
6. Process only after the file reaches `READY_TO_PROCESS`.

## Limitations and troubleshooting

The assistant is intentionally conservative. Missing required columns, low confidence, unknown source/report type, or ambiguous identity fields require user review. AI failure must not break deterministic File Hub classification; rerun suggestions or create mappings manually.

## When AI is used

The AI Schema Assistant is not required for standard schemas. File Hub first attempts attached mappings, active project mappings, and trusted built-in source/report-type defaults. AI is only useful when those deterministic paths cannot safely resolve the schema, for example when headers are renamed, critical columns are missing, the schema is ambiguous, or a default mapping fails validation.

AI still only assists schema mapping. It does not analyze performance, compare campaigns, infer trends, or generate optimization recommendations from sample rows.
