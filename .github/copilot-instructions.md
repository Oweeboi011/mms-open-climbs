# Copilot instructions

MMS Open Climbs: React 18 + Vite SPA on Firebase (Firestore `openclimbs`
database, Auth, Storage, Cloud Functions v2). JavaScript only — no
TypeScript, no CSS frameworks.

Read these instead of guessing; they are the source of truth:

- [`.claude/CLAUDE.md`](../.claude/CLAUDE.md) — commands, architecture, conventions
- [`docs/guides/CODE-QUALITY.md`](../docs/guides/CODE-QUALITY.md) — every gate and how to fix it
- [`docs/guides/ARCHITECTURE.md`](../docs/guides/ARCHITECTURE.md) — layers; Firebase only via `src/services` ([ADR 0004](../docs/adr/0004-services-layer.md))
- [`CONTEXT.md`](../CONTEXT.md) — domain vocabulary

Before proposing a change is done: `npm run qa` must pass.
