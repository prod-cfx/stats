# Backend / Quantify Prisma Client Isolation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate `backend` and `quantify` onto separate Prisma client outputs so both services can build and run independently without overwriting each other's generated types.

**Architecture:** Each service will generate Prisma client code into its own app-local output directory and expose it through a service-local Prisma entry module. Business code in `apps/backend` and `apps/quantify` will stop importing shared `@prisma/client` directly and instead consume their own local Prisma surface. Build targets will always run service-local `prisma:generate` first.

**Tech Stack:** Prisma 7, NestJS, Nx, pnpm, TypeScript, Jest, dx launcher

---

## File Structure

### Backend

- Modify: `apps/backend/prisma/schema/base.prisma`
  - Add backend-local Prisma client `output`
- Modify: `apps/backend/src/prisma/prisma.types.ts`
  - Re-export backend-local Prisma types and `PrismaClient`
- Modify: `apps/backend/src/prisma/prisma.service.ts`
  - Switch runtime client import to backend-local Prisma output
- Modify: `apps/backend/project.json`
  - Ensure `build` depends on `prisma:generate`
- Modify: `apps/backend/src/**`
  - Replace direct `@prisma/client` imports with backend-local Prisma entry

### Quantify

- Modify: `apps/quantify/prisma/schema/base.prisma`
  - Add quantify-local Prisma client `output`
- Create: `apps/quantify/src/prisma/prisma.types.ts`
  - Re-export quantify-local Prisma types and `PrismaClient`
- Modify: `apps/quantify/src/prisma/prisma.service.ts`
  - Switch runtime client import to quantify-local Prisma output
- Modify: `apps/quantify/src/**`
  - Replace direct `@prisma/client` imports with quantify-local Prisma entry

### Shared / Tooling

- Modify: `.gitignore`
  - Ignore generated Prisma client output directories
- Create: `scripts/__tests__/backend-prisma-isolation-contract.spec.cjs`
  - Verify backend build depends on backend-local `prisma:generate` and backend local Prisma entry exists
- Modify: `scripts/__tests__/quantify-build-contract.spec.cjs`
  - Extend contract to check quantify local Prisma output / entry expectations

---

## Chunk 1: Prisma Output Isolation

### Task 1: Add failing contract tests for isolated Prisma outputs

**Files:**
- Create: `scripts/__tests__/backend-prisma-isolation-contract.spec.cjs`
- Modify: `scripts/__tests__/quantify-build-contract.spec.cjs`

- [ ] **Step 1: Write the failing tests**

Add assertions that:
- backend `base.prisma` declares app-local `output`
- quantify `base.prisma` declares app-local `output`
- backend `project.json` build depends on `prisma:generate`
- quantify `project.json` build depends on `prisma:generate`

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test scripts/__tests__/backend-prisma-isolation-contract.spec.cjs scripts/__tests__/quantify-build-contract.spec.cjs
```

Expected:
- At least one failing assertion for missing local output configuration

- [ ] **Step 3: Add minimal Prisma generator output configuration**

Edit:
- `apps/backend/prisma/schema/base.prisma`
- `apps/quantify/prisma/schema/base.prisma`

Set explicit local output directories, for example:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../generated/prisma"
}
```

- [ ] **Step 4: Ignore generated output directories**

Edit `.gitignore` and add:

```gitignore
apps/backend/generated/
apps/quantify/generated/
```

- [ ] **Step 5: Re-run contract tests**

Run:

```bash
node --test scripts/__tests__/backend-prisma-isolation-contract.spec.cjs scripts/__tests__/quantify-build-contract.spec.cjs
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add .gitignore \
  apps/backend/prisma/schema/base.prisma \
  apps/quantify/prisma/schema/base.prisma \
  scripts/__tests__/backend-prisma-isolation-contract.spec.cjs \
  scripts/__tests__/quantify-build-contract.spec.cjs
git commit -m "test: isolate prisma client outputs"
```

## Chunk 2: Quantify Local Prisma Entry

### Task 2: Add quantify-local Prisma entry and switch runtime imports

**Files:**
- Create: `apps/quantify/src/prisma/prisma.types.ts`
- Modify: `apps/quantify/src/prisma/prisma.service.ts`
- Modify: `apps/quantify/src/**/*.ts`
- Test: `apps/quantify/src/common/utils/prisma-enum-mappers.spec.ts`

- [ ] **Step 1: Write a failing grep-based inventory**

Run:

```bash
rg -n "from '@prisma/client'|from \"@prisma/client\"" apps/quantify/src -g '!dist'
```

Expected:
- Direct imports still exist

- [ ] **Step 2: Create quantify-local Prisma entry**

Create `apps/quantify/src/prisma/prisma.types.ts` exporting:

```ts
export * from '../../generated/prisma'
export { Prisma, PrismaClient } from '../../generated/prisma'
```

Adjust relative path if needed to match generated output layout exactly.

- [ ] **Step 3: Switch quantify runtime service to local client**

Edit `apps/quantify/src/prisma/prisma.service.ts`:
- Replace imports from `@prisma/client`
- Import `Prisma` / `PrismaClient` from local Prisma entry

- [ ] **Step 4: Replace quantify business imports**

Batch replace in `apps/quantify/src/**`:
- `from '@prisma/client'`
- to local Prisma entry path used by the app

Keep import style consistent:

```ts
import type { ExchangeAccount } from '@/prisma/prisma.types'
import { Prisma, PrismaClient } from '@/prisma/prisma.types'
```

- [ ] **Step 5: Run quantify Prisma generate**

Run:

```bash
pnpm --filter @net/quantify run prisma:generate
```

Expected:
- Local client generated into `apps/quantify/generated/prisma`

- [ ] **Step 6: Run quantify unit checks**

Run:

```bash
pnpm --filter @net/quantify exec jest --config ./jest-unit.json src/common/utils/prisma-enum-mappers.spec.ts src/config/quantify-env.spec.ts --runInBand
```

Expected:
- PASS

- [ ] **Step 7: Run quantify build**

Run:

```bash
pnpm exec dx build quantify --dev
```

Expected:
- PASS

- [ ] **Step 8: Verify quantify source no longer imports shared Prisma**

Run:

```bash
rg -n "from '@prisma/client'|from \"@prisma/client\"" apps/quantify/src -g '!dist'
```

Expected:
- No matches

- [ ] **Step 9: Commit**

```bash
git add apps/quantify/src/prisma/prisma.types.ts \
  apps/quantify/src/prisma/prisma.service.ts \
  apps/quantify/src
git commit -m "refactor: isolate quantify prisma client"
```

## Chunk 3: Backend Local Prisma Entry

### Task 3: Switch backend to backend-local Prisma entry

**Files:**
- Modify: `apps/backend/src/prisma/prisma.types.ts`
- Modify: `apps/backend/src/prisma/prisma.service.ts`
- Modify: `apps/backend/src/**/*.ts`
- Modify: `apps/backend/project.json`

- [ ] **Step 1: Write a failing grep-based inventory**

Run:

```bash
rg -n "from '@prisma/client'|from \"@prisma/client\"" apps/backend/src -g '!dist'
```

Expected:
- Direct imports still exist

- [ ] **Step 2: Update backend Prisma entry**

Edit `apps/backend/src/prisma/prisma.types.ts` to export backend-local generated client:

```ts
export * from '../../generated/prisma'
export { Prisma, PrismaClient } from '../../generated/prisma'
```

- [ ] **Step 3: Switch backend runtime service to local client**

Edit `apps/backend/src/prisma/prisma.service.ts`:
- Replace imports from `@prisma/client`
- Import from backend-local Prisma entry

- [ ] **Step 4: Replace backend business imports**

Batch replace in `apps/backend/src/**`:
- `from '@prisma/client'`
- to local backend Prisma entry

- [ ] **Step 5: Ensure backend build depends on backend prisma generate**

Check `apps/backend/project.json`.
If missing, set:

```json
"dependsOn": ["^build", "prisma:generate"]
```

- [ ] **Step 6: Run backend Prisma generate**

Run:

```bash
pnpm --filter @net/backend run prisma:generate
```

Expected:
- Local client generated into `apps/backend/generated/prisma`

- [ ] **Step 7: Run backend build**

Run:

```bash
pnpm --filter @net/backend run build
```

Expected:
- PASS

- [ ] **Step 8: Verify backend source no longer imports shared Prisma**

Run:

```bash
rg -n "from '@prisma/client'|from \"@prisma/client\"" apps/backend/src -g '!dist'
```

Expected:
- No matches

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/prisma/prisma.types.ts \
  apps/backend/src/prisma/prisma.service.ts \
  apps/backend/src \
  apps/backend/project.json
git commit -m "refactor: isolate backend prisma client"
```

## Chunk 4: Cross-Service Stability Verification

### Task 4: Prove both services are stable in arbitrary generation order

**Files:**
- Test: `scripts/__tests__/backend-prisma-isolation-contract.spec.cjs`
- Test: `scripts/__tests__/quantify-build-contract.spec.cjs`

- [ ] **Step 1: Run generate in backend -> quantify order**

Run:

```bash
pnpm --filter @net/backend run prisma:generate
pnpm --filter @net/quantify run prisma:generate
pnpm --filter @net/backend run build
pnpm exec dx build quantify --dev
```

Expected:
- All commands PASS

- [ ] **Step 2: Run generate in quantify -> backend order**

Run:

```bash
pnpm --filter @net/quantify run prisma:generate
pnpm --filter @net/backend run prisma:generate
pnpm exec dx build quantify --dev
pnpm --filter @net/backend run build
```

Expected:
- All commands PASS

- [ ] **Step 3: Run quantify startup verification**

Run:

```bash
pnpm exec dx start quantify --dev
curl http://127.0.0.1:3010/api/v1/health
```

Expected:
- Health endpoint returns 200 with `service: "quantify"`

- [ ] **Step 4: Run full local coexistence verification**

Run:

```bash
pnpm exec dx start all
curl http://127.0.0.1:3000/api/v1/health
curl http://127.0.0.1:3010/api/v1/health
curl -I http://127.0.0.1:3001
curl -I http://127.0.0.1:3500
```

Expected:
- backend 200
- quantify 200
- front reachable
- admin-front reachable / redirects as expected

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: verify backend quantify prisma isolation"
```

## Chunk 5: Cleanup and Documentation Sweep

### Task 5: Remove residual shared Prisma assumptions

**Files:**
- Modify: any docs / scripts found by grep
- Test: repository-wide grep checks

- [ ] **Step 1: Search for residual shared Prisma imports**

Run:

```bash
rg -n "from '@prisma/client'|from \"@prisma/client\"" apps/backend apps/quantify -g '!dist'
```

Expected:
- Matches only in allowed transitional files, tests explicitly mocking Prisma, or none

- [ ] **Step 2: Review allowed exceptions**

If any matches remain:
- confirm they are intentional test mocks only
- otherwise replace them with local Prisma entry imports

- [ ] **Step 3: Search for docs or scripts that still assume shared Prisma output**

Run:

```bash
rg -n "@prisma/client|generated/prisma|prisma generate" apps/backend apps/quantify docs scripts dx -g '!dist'
```

Expected:
- No incorrect references to shared output assumptions

- [ ] **Step 4: Final verification bundle**

Run:

```bash
node --test scripts/__tests__/backend-prisma-isolation-contract.spec.cjs scripts/__tests__/quantify-build-contract.spec.cjs scripts/__tests__/quantify-runtime-contract.spec.cjs
pnpm --filter @net/backend run build
pnpm exec dx build quantify --dev
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: remove shared prisma client assumptions"
```
