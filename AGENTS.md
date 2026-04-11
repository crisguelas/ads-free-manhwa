# AGENTS Guide: Read This Before Coding

This file defines mandatory instructions for coding agents working in this project.

## 1) Pre-Coding Checklist (Do First)

Before writing or changing code, always:

1. Read `README.md` fully.
2. Confirm the task scope and avoid adding unrequested features.
3. Identify impacted files/routes/components before editing.
4. Prefer the smallest safe change that solves the requested problem.
5. Note any missing requirements and ask concise clarifying questions only when necessary.

Do not start implementation until this checklist is complete.

## 2) Project Standards

- Framework: Next.js 16 App Router + TypeScript.
- Styling: Tailwind CSS first. Avoid introducing new styling systems.
- Data layer: Prisma + PostgreSQL (Neon).
- Imports: use `@/*` alias where appropriate.
- Secrets: never hard-code credentials, tokens, or database URLs.
- UX priority: mobile-first, clean, premium feel, smooth and subtle interactions; browse UI may use scan-site *layout patterns* (lists, sidebars) on a **light** theme — do not copy third-party logos or brand assets.

## 3) Implementation Rules

- Keep functions/components focused and readable.
- Reuse existing patterns/components before creating new abstractions.
- Add comments for every function, class, type/interface, and exported constant.
- For each comment, explain purpose and behavior (not just restating the name).
- Keep comments concise and maintain them whenever logic changes.
- Do not perform broad refactors unless explicitly requested.
- Preserve backward compatibility unless task requirements state otherwise.
- Avoid unnecessary dependencies; use built-in tooling first.

## 4) Authentication and Community Scope

- Authentication strategy is email + password only.
- Social login integrations are out of scope unless explicitly requested.
- Community features are out of scope:
  - comments
  - discussion threads
  - social feeds
  - public community pages
- If a task suggests community features, pause and confirm with the user before implementing.

## 5) File and Architecture Discipline

- Keep route logic in `app/` and shared UI in `components/`.
- Keep shared utilities in `lib/`.
- Keep schema and migrations in `prisma/`.
- Keep global style tokens and shared styles in `styles/`.
- Do not create files outside project scope.

## 6) Validation and Quality Gates

For meaningful changes, run:

```bash
npm run lint
npm run build
```

For database-related changes, also run:

```bash
npx prisma generate
npx prisma migrate dev
```

Manually verify relevant user flows on mobile viewport where UI is touched.

## 7) Safety and Change Control

- Never delete or overwrite unrelated code.
- Never commit secrets or environment values.
- If you discover conflicting or unexpected local edits, pause and report clearly.
- If requirements are ambiguous, ask before implementing speculative behavior.

## 8) Development History Tracking (Mandatory)

- Update `DEVELOPMENT_HISTORY.md` after every meaningful milestone.
- Log work from scratch to latest, so future developers can follow decisions and sequence.
- Each entry must include:
  - objective
  - changes made
  - verification
  - next step
- Keep entries factual and concise. Do not skip setup-level milestones.

## 9) Definition of Done

A task is complete only when:

- Requested behavior is implemented.
- Changes are scoped and minimal.
- Lint/build checks pass (or failures are reported with exact cause).
- README/inline docs are updated when behavior/setup changes.
- `DEVELOPMENT_HISTORY.md` is updated for the completed milestone.
- The result is explained clearly with what changed and why.
