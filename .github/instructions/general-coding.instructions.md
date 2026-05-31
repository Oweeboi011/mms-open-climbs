---
applyTo: "**"
---

# Project general coding standards

## Repository Structure

- `src/backend/`: Python backend services and APIs
- `src/frontend/`: TypeScript + React (Vite) frontend application
- `src/mcp_server/`: MCP server implementation
- `src/tests/` and `tests/`: Test suites (unit, integration, e2e)
- `infra/`: Azure/Bicep infrastructure definitions
- `scripts/`: Local development and automation scripts
- `data/`: Sample datasets and agent team configuration
- `docs/`: Product, architecture, and operational documentation
- `docs/adr/`: Architecture Decision Records (ADRs)

## Required before each commit

- Run formatting and linting checks for touched areas
- Run tests for touched areas, then broader tests when feasible
- Frontend (`src/frontend/`): run `npm run lint`, `npm run type-check`, and relevant `npm run test`/`npm run build` commands
- Python services (`src/backend/`, `src/mcp_server/`): run relevant `pytest` suites and required static checks
- Update `README.md` and affected docs under `docs/` when behavior, setup, or architecture changes
- For architecture changes, add or update ADRs and update the ADR index
- Do not edit the ADR template

## General Guidelines

1. Keep changes scoped to the request; avoid unrelated refactors
2. Maintain existing project structure and module boundaries
3. Prefer root-cause fixes over superficial patches
4. Follow existing patterns in each area (backend, frontend, MCP server)
5. Never commit secrets, keys, or tenant-specific values

## Writing and labelling guidelines

- Use US English for all code and documentation
- Write clear and concise comments only where they add value
- Keep naming descriptive and domain-relevant

## Naming Conventions

### TypeScript/React
- Use PascalCase for component names, interfaces, and type aliases
- Use camelCase for variables, functions, and methods
- Prefix private class members with underscore (\_)
- Use ALL_CAPS for constants

### Python
- Use snake_case for variables, functions, and methods
- Use PascalCase for class names
- Use ALL_CAPS for constants
- Prefix private class members with underscore (\_)
- Use descriptive names for AI agents and plugins

## Error Handling

### General Principles
- Use appropriate exception handling for each language (try/catch in TypeScript, try/except in Python)
- Implement proper error boundaries in React components
- Always log errors with contextual information
- Include correlation IDs for tracing across services
- Use structured error responses for API endpoints

### AI-Specific Error Handling
- Handle AI service timeouts and rate limiting gracefully
- Implement fallback responses for AI failures
- Log AI token usage and costs with errors where available
- Provide user-friendly error messages for AI-related failures
- Do not expose secrets, tokens, or sensitive prompt/user data in logs

## Answering Questions

- Answer all questions in the style of a friendly colleague, using informal language.
- Answer all questions in less than 1000 characters, and words of no more than 12 characters.
