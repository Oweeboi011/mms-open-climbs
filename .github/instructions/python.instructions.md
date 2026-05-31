---
applyTo: "**/*.py"
---

# Python Coding Standards

Apply the [general coding guidelines](./general-coding.instructions.md) to all Python code.

## Scope

These rules apply to:

- `src/backend/`
- `src/mcp_server/`
- Python tests under `src/tests/` and `tests/`

## Environment and Dependencies

- Use Python 3.12.
- Use `uv` for dependency sync in service folders (`uv sync --frozen`).
- Keep dependency updates minimal and scoped to the change.

## Code Style and Design

- Use snake_case for functions, methods, and variables.
- Use PascalCase for class names.
- Add type hints to public function signatures and complex internal APIs.
- Keep modules and functions focused; avoid large multi-purpose files.
- Reuse existing utilities and service abstractions before adding new ones.

## FastAPI and Service Patterns

- Keep request/response schemas explicit and validated.
- Return consistent HTTP errors with useful context.
- Prefer dependency injection patterns already present in the codebase.
- Keep business logic out of route handlers when possible.

## Async and External Calls

- Use `async`/`await` for I/O operations.
- Avoid blocking calls inside async paths.
- Add retries/timeouts only where failure modes justify them.
- Handle service failures gracefully and return safe fallback/error responses.

## Logging and Security

- Use structured, contextual logging.
- Include correlation or request IDs where available.
- Never log secrets, tokens, credentials, or sensitive prompt/user content.
- Read secrets from environment/configuration, never hardcode them.

## Testing

- Use `pytest` and `pytest-asyncio` patterns already used in the repo.
- Add or update focused tests near the changed behavior.
- Mock external systems in unit tests.
- Run relevant tests for touched Python areas before hand-off.

## Documentation

- Update docstrings for public APIs when behavior changes.
- Update related docs in `docs/` when setup or runtime behavior changes.