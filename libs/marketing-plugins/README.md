# marketing-plugins

Deterministic processing and analysis plugins for AI Marketing Copilot.

## Contains

- Analysis Engine orchestration and V1 deterministic rules.
- V1 rules: `HIGH_SPEND_ZERO_CONVERSIONS`, `LOW_CTR`, `HIGH_CPC`, `HIGH_CPA`, `LOW_ROAS`, `KEYWORD_WASTE`, `SCALING_OPPORTUNITY`, and `DATA_QUALITY_WARNING`.
- AppsFlyer report profiler, stream parser, column mapper, event-value parser, normalizer, event dictionary, KPI calculator and deterministic facts plugin.

## Current processing notes

- AppsFlyer CSV processing is the currently wired production-like path.
- Processing should remain stream-based; do not load large CSV files fully into memory.
- Event Value parsing should be defensive and row-level tolerant.
- AppsFlyer alone is not a trusted cost source for ROAS/CPA/CAC facts in V1.
