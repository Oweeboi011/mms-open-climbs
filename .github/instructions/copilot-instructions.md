# GitHub Copilot Instructions

## Project Overview

This repository is the Multi-Agent Custom Automation Engine Solution Accelerator.

Primary stack in this repo:

- Backend: Python 3.12, FastAPI, Pydantic
- Frontend: React 18 + TypeScript + Vite
- MCP: Python MCP server under `src/mcp_server`
- Infra: Azure Developer CLI (`azd`) + Bicep (`infra/`)

## Source of Truth for Structure

- Backend API: `src/backend/`
- Frontend app: `src/frontend/`
- MCP server: `src/mcp_server/`
- Tests: `src/tests/` and `tests/`
- Infra: `infra/`
- Scripts: `scripts/`
- Docs: `docs/`

Do not assume other folder layouts unless the code in this repo shows them.

## Working Rules

1. Keep changes scoped to the request.
2. Prefer root-cause fixes over quick patches.
3. Follow existing patterns in the touched module.
4. Do not introduce new frameworks or architecture styles unless requested.
5. Never commit secrets, tenant IDs, tokens, or keys.

## Validation Before Hand-off

Run only checks relevant to changed code:

- Frontend (`src/frontend/`): `npm run lint`, `npm run type-check`, and relevant `npm run test`.
- Backend/MCP (`src/backend/`, `src/mcp_server/`): relevant `pytest` suites and configured static checks.

If a check cannot run locally, state what was skipped and why.

## Documentation Expectations

- Update `README.md` and related files under `docs/` when setup, behavior, or architecture changes.
- For architecture decisions, add/update ADRs and update the ADR index.
- Do not edit ADR templates.

## Coding Expectations

- Use explicit and descriptive naming.
- Keep functions and classes focused and cohesive.
- Add comments only where intent is not obvious from code.
- Include robust error handling and contextual logging.
- Do not log secrets or sensitive user/prompt content.

## Frontend Expectations

- Use existing React + TypeScript patterns in `src/frontend/`.
- Respect existing UI/component conventions (including Fluent UI usage where present).
- Prefer composition and reusable components over one-off complex components.

## Backend and MCP Expectations

- Use async patterns for I/O-bound operations.
- Validate inputs with existing models and schemas.
- Return structured, actionable errors from APIs.
- Preserve correlation IDs and tracing context where already used.