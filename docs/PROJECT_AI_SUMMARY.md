# Project AI Summary

## What data AI uses

Project AI summaries use bounded, processed Project Gold context only:

- project-level KPIs from ClickHouse Silver events
- project-scope detected facts
- project data-availability summary
- period funnel and cohort funnel summaries
- media-source quality scores and reasons
- blocked traffic analysis
- bounded semantic entities/relationships/context objects
- explicit unavailable metrics and limitations

## What AI cannot use

AI cannot use raw CSV files, raw rows, raw payloads, unbounded event dumps, or ad-cost assumptions. It must not calculate joins in the prompt and must not invent ROAS, CPA, CAC, profit, or spend.


## AI chat project context behavior

Controlled questions (`POST /projects/:id/questions` and the `/ai-chat` compatibility alias) do not send raw CSV rows to the provider. When the user asks a general project-level question and no `importId` filter is provided, the chat data layer prefers the latest completed Project Gold summary for the requested source/date range.

The bounded chat context can include:

- Project Gold KPIs and data availability.
- Period funnel metrics and cohort funnel windows when available.
- Media-source quality rankings and deterministic scoring reasons.
- Project-scope detected facts, recommendations, and reports.
- Blocked traffic aggregates: blocked/accepted installs, blocked/accepted in-app events, rates, top blocked/rejected reasons, and top blocked media-source distribution.
- Explicit unavailable metrics, especially ROAS/CPA/CAC when no reliable cost source exists.

The AI should treat this as the authoritative project-level context. Import-level facts are supporting evidence only when an import filter is used or Project Gold has not been computed.

## Blocked traffic context in AI answers

AI answers can discuss blocked traffic only from deterministic Project Gold summaries or bounded reader data. The prompt must explain that blocked traffic is excluded from the main funnel and analyzed separately.

The AI receives blocked traffic as aggregate context, not as a full event dump. This is intentional:

- Safe to include: counts, rates, top reason distributions, top media-source distributions, and project facts such as `PROJECT_HIGH_BLOCKED_TRAFFIC_RATE`.
- Not safe to include: raw CSV rows, raw payloads, device/user identifiers, or every blocked event record.

If a user asks for every blocked row or raw evidence, the answer should explain that raw CSV/event rows are not available to AI and suggest using backend exports or ClickHouse/debug tooling outside the AI prompt.

## When Project Gold is missing

If Project Gold has not been computed, project-level/general questions must not be answered by inventing joins from isolated import facts. The controlled question flow should say that project-level analysis has not been computed yet and suggest running `recompute-project-gold` through:

```http
POST /projects/:id/analysis/recompute
```

## Prompt rules

The defensive prompt requires AI to:

- answer only from bounded JSON context
- cite limitations when data is incomplete
- distinguish period funnel from cohort funnel
- state that blocked traffic is excluded from the main funnel
- say ROAS/CPA/CAC cannot be calculated without reliable cost data
- explain monetary values as Event Value.amount when Event Revenue is empty

## How project facts are used

Project facts are the primary explanation layer for project-level questions. Facts tell AI what deterministic calculations are available, what is missing, and what recommendation hints are safe. General chat questions prefer project facts/KPIs/reports before import-level evidence.

## How semantic context is used

Semantic context helps ground names and relationships such as media source → campaign → event. It does not calculate numeric KPIs. All numeric values come from deterministic ClickHouse aggregations in the Project Gold Engine.

## Example answers

### Can we calculate ROAS?

No. AppsFlyer-only project analysis has no reliable cost source, so ROAS, CPA, and CAC cannot be calculated. Event Value.amount can support event monetary analysis, but it is not ad spend or profit.

### What is the install to FTD rate?

If cohort analysis is available, use the requested cohort window (for example D7 install → FTD). If cohort analysis is incomplete, use the period install → FTD rate only when installs and FTD users are present, and label it period-based rather than a true install cohort.

### Which media source performed best?

Use the project media-source quality ranking. Explain that the score is based on conversion quality and blocked/noisy traffic penalties, not profitability, because cost is missing.

## ROAS limitation

ROAS requires reliable cost/spend. AppsFlyer event amount or event revenue cannot substitute for media cost. Until Google Ads/paid media cost ingestion is implemented, project AI must say ROAS is unavailable.

## Cohort vs period explanation

Period funnel counts events in the same selected period. Cohort funnel starts from install users and follows their later events through D0/D1/D3/D7/D30 windows. Cohort is preferred for install-to-FTD questions when identity matching is available.
