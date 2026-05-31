---
applyTo: "**/*.ts,**/*.tsx"
---

# TypeScript and React Coding Standards

Apply the [general coding guidelines](./general-coding.instructions.md) to all TypeScript and React code.

## Scope

These rules primarily apply to `src/frontend/`.

## Frontend Stack

- React 18 + TypeScript + Vite
- Fluent UI components are used in this solution
- Testing uses Vitest and Testing Library

## TypeScript Guidelines

- Use TypeScript for all new frontend code.
- Use descriptive types and interfaces for API and component contracts.
- Prefer `const` and immutable updates.
- Avoid `any` unless unavoidable; narrow unknown values safely.
- Keep utility functions small and reusable.

## React Guidelines

- Use functional components and hooks.
- Follow hook rules (no conditional hook calls).
- Keep state close to where it is used.
- Split large components into focused subcomponents.
- Reuse shared components and helpers before creating new ones.

## Styling and UI

- Follow existing frontend styling patterns in the repo.
- Use existing design tokens/component primitives where available.
- Do not introduce hard-coded brand/theme values when existing tokens exist.
- Keep accessibility in mind (labels, keyboard support, contrast, semantics).

## Linting, Formatting, and Type Checks

Use existing frontend scripts in `src/frontend/package.json`:

- `npm run lint`
- `npm run type-check`
- `npm run format:check` (or `npm run format` when needed)

## Testing Guidelines

- Add or update targeted tests for changed behavior.
- Use Vitest + Testing Library patterns already present.
- Prefer behavior-focused assertions over implementation details.
- Keep tests deterministic and avoid live network calls.
- Do not commit focused tests (`.only`) or intentionally skipped tests without reason.

## Documentation

- Update user-facing docs when frontend behavior or setup changes.
- Keep comments concise and only where intent is non-obvious.