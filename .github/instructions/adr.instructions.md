---
applyTo: "**/docs/adr/*.md"
---

# ADR Processing Guidelines

Apply the [general coding guidelines](./general-coding.instructions.md) to ADR work.

## Core Principles

1. One ADR documents one architecture decision.
2. ADRs are append-only records; supersede with a new ADR instead of rewriting history.
3. Use clear US English and consistent technical terms.
4. Keep rationale tied to this repository’s architecture and operations.
5. Do not modify ADR templates.

## Naming and File Management

- Use file names in the form `NNNN-title-with-hyphens.md`.
- Use the next available sequence number.
- Keep titles short and specific.
- Use lowercase letters and hyphens only.

## Required Updates for New ADRs

- Create from the repository ADR template.
- Set status to `proposed` initially.
- Use the current date in the ADR metadata.
- Update ADR index/navigation files if present.
- Add relative links to related ADRs where useful.

## ADR Content Expectations

- Context: problem, constraints, and why now.
- Decision: chosen option and scope.
- Alternatives: at least one viable alternative with trade-offs.
- Consequences: impacts on code, operations, cost, security, and maintainability.

## Change and Status Management

- To change status, update status metadata and the relevant date fields.
- If superseded, reference the new ADR and update links in both places.
- Avoid editing accepted ADR body content except for metadata/link maintenance.

## Quality Checks

- Validate Markdown formatting and relative links.
- Ensure statements are accurate with current repo structure and tech stack.
- Keep ADRs concise and actionable for future maintainers.