# AI Marketing Copilot — Agent Instructions Compatibility File

`AGENTS.md` is the canonical instruction and implementation-memory file for this repository. This singular `AGENT.md` file is kept only for backward compatibility with older tooling or humans who still open it directly.

## Current status summary

- EventStream Platform is being extended with the AI Marketing Copilot feature layer; do not rebuild the core.
- Current production-like flow: File Hub raw CSV upload → AppsFlyer stream processing → ClickHouse Silver/Gold writes → PostgreSQL facts/audit/semantic/context → facts-first AI outputs → controlled questions/chat.
- Explicit AI analysis runs are implemented with `POST /projects/:id/analysis-runs`, queue `marketing-analysis`, and job `generate-ai-analysis`.
- Controlled chat with IA is implemented through `POST /projects/:id/questions`; `POST /projects/:id/ai-chat` is a compatibility alias.
- The HTML/JavaScript test UI lives at `apps/admin/src/assets/atlas-ai-test-ui.html` and is served from `/api/ui` by `apps/admin`.
- Current fully wired CSV processing is AppsFlyer. Google Ads CSV processing remains the next V1 execution target.

## Rules for future agents

Read and update `AGENTS.md` first. If a critical status summary must be mirrored here, keep it short and point readers back to `AGENTS.md`.
