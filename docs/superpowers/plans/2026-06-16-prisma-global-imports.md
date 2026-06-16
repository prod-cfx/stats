# Prisma Global Imports Implementation Plan

**Goal:** Remove redundant `PrismaModule` imports from backend runtime feature modules while keeping root-level global infrastructure wiring intact.
**Track:** B
**Issue:** #2531

## Files

- Create: `apps/backend/src/modules/prisma-global-imports-boundary.spec.ts`
- Modify: `apps/backend/src/modules/*/*.module.ts` files that import `@/prisma/prisma.module`
- Preserve: `apps/backend/src/modules/app.module.ts`
- Preserve: `apps/backend/src/prisma/prisma.module.ts`

## Steps

1. Add static regression spec that scans `apps/backend/src/modules/**/*.module.ts` and fails when any file except `app.module.ts` imports `@/prisma/prisma.module`.
2. Run focused backend unit spec and confirm RED failure caused by existing feature module imports.
3. Remove `PrismaModule` imports from runtime feature modules and clean `imports` arrays without changing providers, controllers, or repository constructors.
4. Run focused backend unit spec and confirm GREEN.
5. Run parallel verification: `dx lint`, `dx build backend --dev`, and focused backend unit spec.
6. Commit on `codex/chore/2531-prisma-global-imports`, push, conflict-check against `origin/main`, and create PR.

## Verify

- `dx test unit backend apps/backend/src/modules/prisma-global-imports-boundary.spec.ts`
- `dx lint`
- `dx build backend --dev`

## Commit

- Commit title: `chore: remove redundant backend PrismaModule imports`
- Commit footer: `Refs: #2531`
