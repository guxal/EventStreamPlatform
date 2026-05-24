# AppsFlyer + Medallion Implementation Notes (V1 Backend)

## Idempotency for `marketing_events`

For AppsFlyer imports, row-level dedupe with `import_id + row_hash` is not enough by itself when using ClickHouse merge-tree engines.

Recommended strategy order:
1. **IMPORT_REPLACE**: delete all rows for `import_id` before batch reinsert on retry.
2. **REPLACING_MERGETREE_FINAL**: if replacement-by-version is used, aggregate queries that feed KPI calculators should use `FINAL` where correctness is required.

## Event Value defensive parsing

`Event Value` may contain malformed JSON or unexpected key/value pairs.

Parser guidance:
1. Try strict JSON parsing first.
2. If parse fails, apply regex fallback for monetary keys (`amount`, `revenue`).
3. Never fail whole stream for one malformed row; register warning and continue.

## Stream-only processing

Use direct object-storage stream -> CSV parser -> normalizer transform -> ClickHouse bulk insert.
Avoid writing full temp CSV files on container disk for large AppsFlyer exports.

## Time fields for delayed-reward analytics

Keep the following normalized timestamps in Silver events:
- `event_time`
- `install_time`
- `attributed_touch_time`

These are required for attribution lag analysis and historical recomputation of Gold snapshots.
