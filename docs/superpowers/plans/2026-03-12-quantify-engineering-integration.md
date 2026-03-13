# Quantify Engineering Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/quantify` a first-class monorepo app with its own identity, env validation/mapping, `dx` commands, Prisma flow, tests, and docs, while keeping it as an independent microservice.

**Architecture:** Keep the design minimal and aligned with the existing `net` repo style. Add `quantify` as a parallel backend app in the workspace, introduce a single `dx` launcher wrapper for quantify-only env mapping/validation, and extend `dx`/env-policy incrementally without breaking existing backend commands.

**Tech Stack:** Nx, pnpm workspace, NestJS, Prisma, dx command config, Node.js CommonJS launcher scripts, Jest/E2E

---

## Chunk 1: Engineering Integration

### Task 1: Re-establish Quantify App Identity

**Files:**
- Modify: `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/package.json`
- Modify: `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/project.json`
- Modify: `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/src/main.ts`
- Modify: `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/src/config/configuration.ts`
- Search/verify: `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/**`

- [ ] **Step 1: Write the failing identity verification checks**

Create a temporary verification checklist in the working notes for these assertions:

```text
1. apps/quantify/package.json name === "@net/quantify"
2. apps/quantify/project.json targets no longer point to @net/backend
3. quantify default port is 3010
4. quantify swagger title is "Quantify API"
5. quantify logger/app name is quantify-oriented, not backend-oriented
```

- [ ] **Step 2: Verify current state fails the checks**

Run:

```bash
rg -n '"name": "@net/backend"|pnpm --filter @net/backend|@net/backend' /Users/zengmengdan/coinfulx-new/stats/apps/quantify
```

Expected: matches found in `apps/quantify/package.json`, `apps/quantify/project.json`, and possibly config defaults.

- [ ] **Step 3: Apply the minimal identity fixes**

Implement:

- Change package name to `@net/quantify`
- Rewrite these `project.json` fields explicitly:
  - `name`
  - `sourceRoot`
  - `tags`
  - `targets.build.options.command`
  - `targets.build.outputs`
  - `targets.dev.options.command`
  - `targets.start.options.command`
  - `targets.test.options.command`
  - `targets.lint.options.lintFilePatterns`
  - `targets.swagger.options.cwd` if the swagger target remains
- Set quantify default port to `3010`
- Set swagger title to `Quantify API`
- Set quantify app/log defaults away from backend naming

- [ ] **Step 4: Verify identity is corrected**

Run:

```bash
rg -n '"name": "@net/backend"|pnpm --filter @net/backend' /Users/zengmengdan/coinfulx-new/stats/apps/quantify
pnpm --filter @net/quantify run build
```

Expected:

- no incorrect `@net/backend` command references remain in `apps/quantify`
- `pnpm --filter @net/quantify run build` succeeds

- [ ] **Step 5: Commit**

```bash
git add /Users/zengmengdan/coinfulx-new/stats/apps/quantify/package.json /Users/zengmengdan/coinfulx-new/stats/apps/quantify/project.json /Users/zengmengdan/coinfulx-new/stats/apps/quantify/src/main.ts /Users/zengmengdan/coinfulx-new/stats/apps/quantify/src/config/configuration.ts
git commit -m "refactor: establish quantify app identity"
```

### Task 2: Add Quantify Env Target and Launcher

**Files:**
- Modify: `/Users/zengmengdan/coinfulx-new/stats/dx/config/env-policy.jsonc`
- Add: `/Users/zengmengdan/coinfulx-new/stats/scripts/dx/quantify-launcher.cjs`
- Add: `/Users/zengmengdan/coinfulx-new/stats/scripts/dx/__tests__/quantify-launcher.spec.cjs`
- Modify: `/Users/zengmengdan/coinfulx-new/stats/.env.example`
- Modify: `/Users/zengmengdan/coinfulx-new/stats/.env.development`

- [ ] **Step 1: Write the failing launcher tests**

Create tests that cover:

```javascript
it('maps QUANTIFY_DATABASE_URL to DATABASE_URL');
it('does not let blank QUANTIFY_PORT override PORT');
it('fails when QUANTIFY_DATABASE_URL equals DATABASE_URL');
it('fails when QUANTIFY_REDIS_URL is missing');
it('fails when QUANTIFY_DATABASE_URL is not postgres');
it('fails when QUANTIFY_REDIS_URL is not redis');
it('fails when QUANTIFY_PORT is invalid');
it('fails when QUANTIFY_APP_SECRET is missing');
it('fails when QUANTIFY_JWT_SECRET is missing');
it('ignores unknown QUANTIFY_* keys');
```

- [ ] **Step 2: Run the launcher tests to verify failure**

Run:

```bash
node --test /Users/zengmengdan/coinfulx-new/stats/scripts/dx/__tests__/quantify-launcher.spec.cjs
```

Expected: FAIL because launcher file and behavior do not exist yet.

- [ ] **Step 3: Implement the quantify launcher**

Implement `scripts/dx/quantify-launcher.cjs` with a single exported/central flow:

```javascript
function resolveQuantifyEnv(rawEnv) { /* validate, map, return env */ }
```

Responsibilities:

- validate only the declared whitelist keys and ignore unknown `QUANTIFY_*`
- treat `undefined`, `''`, and whitespace-only values as unset
- map only:
  - `QUANTIFY_PORT -> PORT`
  - `QUANTIFY_DATABASE_URL -> DATABASE_URL`
  - `QUANTIFY_REDIS_URL -> REDIS_URL`
  - `QUANTIFY_APP_SECRET -> APP_SECRET`
  - `QUANTIFY_JWT_SECRET -> JWT_SECRET`
- ignore unknown `QUANTIFY_*`
- fail with exact messages from the spec

- [ ] **Step 4: Add env-policy target and env examples**

Update:

- `dx/config/env-policy.jsonc` to add `quantify` target
- root env templates to include the quantify whitelist variables

Keep `QUANTIFY_BASE_URL` as backend-only reserved config and do not map it in launcher.

- [ ] **Step 5: Verify the launcher passes**

Run:

```bash
node --test /Users/zengmengdan/coinfulx-new/stats/scripts/dx/__tests__/quantify-launcher.spec.cjs
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add /Users/zengmengdan/coinfulx-new/stats/dx/config/env-policy.jsonc /Users/zengmengdan/coinfulx-new/stats/scripts/dx/quantify-launcher.cjs /Users/zengmengdan/coinfulx-new/stats/scripts/dx/__tests__/quantify-launcher.spec.cjs /Users/zengmengdan/coinfulx-new/stats/.env.example /Users/zengmengdan/coinfulx-new/stats/.env.development
git commit -m "feat: add quantify env target and launcher"
```

### Task 3: Extend dx Commands for Quantify

**Files:**
- Modify: `/Users/zengmengdan/coinfulx-new/stats/dx/config/commands.json`
- Modify: `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/package.json`
- Modify: `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/project.json`

- [ ] **Step 1: Write the failing command contract checklist**

Define the required commands:

```text
dx start quantify --dev
dx build quantify --dev
dx build quantify --prod
dx test unit quantify
dx test e2e quantify <file>
dx db format quantify
dx db generate quantify
dx db migrate quantify --dev --name init_quantify
dx db seed quantify --dev
dx db seed quantify --e2e
dx db reset quantify --dev
dx db reset quantify --e2e
```

- [ ] **Step 2: Verify the commands do not exist yet**

Run:

```bash
rg -n '"quantify"' /Users/zengmengdan/coinfulx-new/stats/dx/config/commands.json
```

Expected: no or incomplete quantify command coverage.

- [ ] **Step 3: Implement quantify dx commands and script alignment**

Update `dx/config/commands.json` and `apps/quantify/package.json` so that:

- existing backend commands remain unchanged
- `dx db format` and `dx db generate` without app still behave as today
- `dx db format quantify` / `dx db generate quantify` are additive
- `dx test e2e quantify <file>` requires a file path
- `dx db reset quantify` is only available for `dev` and `e2e`

- [ ] **Step 4: Verify the command contract**

Run:

```bash
dx build quantify --dev
dx build quantify --prod
dx test unit quantify
dx db generate quantify
dx db migrate quantify --dev --name init_quantify
dx db seed quantify --e2e
dx db reset quantify --dev
dx db reset quantify --e2e
dx start all
dx test e2e quantify
dx db reset quantify --staging
dx db reset quantify --prod
dx db format
dx db generate
```

Expected success:

- `dx build quantify --dev` exits `0`
- `dx build quantify --prod` exits `0`
- `dx test unit quantify` exits `0`
- `dx db generate quantify` exits `0`
- `dx db migrate quantify --dev --name init_quantify` exits `0`
- `dx db seed quantify --e2e` exits `0`
- `dx db reset quantify --dev` exits `0`
- `dx db reset quantify --e2e` exits `0`

Expected constraints:

- `dx start all` output does not include `quantify`
- `dx test e2e quantify` fails because `<file>` is required
- `dx db reset quantify --staging` fails
- `dx db reset quantify --prod` fails
- `dx db format` and `dx db generate` continue to target backend default behavior

- [ ] **Step 5: Commit**

```bash
git add /Users/zengmengdan/coinfulx-new/stats/dx/config/commands.json /Users/zengmengdan/coinfulx-new/stats/apps/quantify/package.json /Users/zengmengdan/coinfulx-new/stats/apps/quantify/project.json
git commit -m "feat: add quantify dx commands"
```

### Task 4: Integrate Prisma and Runtime Validation

**Files:**
- Modify: `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/prisma.config.ts`
- Modify: `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/prisma/seed.ts`
- Modify: `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/src/main.ts`
- Modify: `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/e2e/health/health.e2e-spec.ts`

- [ ] **Step 1: Write the failing health/runtime checks**

Add or update explicit assertions in `/Users/zengmengdan/coinfulx-new/stats/apps/quantify/e2e/health/health.e2e-spec.ts` for:

```text
quantify starts with mapped env
quantify rejects invalid DB/Redis settings before boot
health endpoint is available at /api/v1/health
```

- [ ] **Step 2: Verify current runtime behavior fails or is incomplete**

Run:

```bash
dx start quantify --dev
```

Expected: FAIL or incomplete behavior until launcher + app wiring is correctly integrated.

- [ ] **Step 3: Wire runtime and Prisma to the quantify contract**

Make sure:

- quantify boot path uses mapped standard vars
- Prisma uses quantify DB only
- seed remains idempotent
- invalid DB/Redis/secret inputs fail before app starts

- [ ] **Step 4: Verify runtime and DB flow**

Run:

```bash
dx db generate quantify
dx db migrate quantify --dev --name init_quantify
dx db seed quantify --dev
dx start quantify --dev
curl -f http://127.0.0.1:3010/api/v1/health
```

Expected:

- db commands exit `0`
- server starts successfully
- `curl` returns HTTP `200`

- [ ] **Step 5: Commit**

```bash
git add /Users/zengmengdan/coinfulx-new/stats/apps/quantify/prisma.config.ts /Users/zengmengdan/coinfulx-new/stats/apps/quantify/prisma/seed.ts /Users/zengmengdan/coinfulx-new/stats/apps/quantify/src/main.ts /Users/zengmengdan/coinfulx-new/stats/apps/quantify/e2e/health/health.e2e-spec.ts
git commit -m "feat: wire quantify prisma and runtime validation"
```

### Task 5: Add CI and Documentation

**Files:**
- Modify: `/Users/zengmengdan/coinfulx-new/stats/.github/workflows/ci.yml`
- Add: `/Users/zengmengdan/coinfulx-new/stats/docs/quantify-development.md`
- Modify: `/Users/zengmengdan/coinfulx-new/stats/README.md`

- [ ] **Step 1: Write the failing CI/doc checklist**

Checklist:

```text
1. quantify-verify exists
2. it always runs
3. it path-filters quantify-related changes
4. it exits 0 with "skipped: no quantify-related changes" when untouched
5. docs/quantify-development.md exists and lists startup/db/test commands
```

- [ ] **Step 2: Verify the checklist currently fails**

Run:

```bash
rg -n 'quantify-verify|quantify-development' /Users/zengmengdan/coinfulx-new/stats/.github/workflows /Users/zengmengdan/coinfulx-new/stats/docs /Users/zengmengdan/coinfulx-new/stats/README.md
```

Expected: no complete quantify CI/doc integration yet.

- [ ] **Step 3: Implement CI and docs**

Implement:

- `quantify-verify` always-run workflow/job behavior
- path-filter first step
- workflow-only implementation:
  - always-run job
  - path-filter first step
  - no-match => log `skipped: no quantify-related changes` and exit `0`
  - match => run quantify verification commands
- `docs/quantify-development.md`
- minimal root README pointer

- [ ] **Step 4: Verify CI/doc outputs**

Run:

```bash
rg -n 'quantify-verify|skipped: no quantify-related changes|dx start quantify --dev|dx db generate quantify|dx test unit quantify' /Users/zengmengdan/coinfulx-new/stats/.github/workflows /Users/zengmengdan/coinfulx-new/stats/docs/quantify-development.md /Users/zengmengdan/coinfulx-new/stats/README.md
```

Expected: all required entries exist.

- [ ] **Step 5: Commit**

```bash
git add /Users/zengmengdan/coinfulx-new/stats/.github/workflows /Users/zengmengdan/coinfulx-new/stats/docs/quantify-development.md /Users/zengmengdan/coinfulx-new/stats/README.md
git commit -m "docs: add quantify development workflow"
```

### Task 6: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run the full quantify verification chain**

Run:

```bash
dx lint
dx build quantify --dev
dx test unit quantify
dx test e2e quantify /Users/zengmengdan/coinfulx-new/stats/apps/quantify/e2e/health/health.e2e-spec.ts
dx db generate quantify
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run explicit failure-path checks**

Run with bad env overrides to confirm failures:

```bash
QUANTIFY_DATABASE_URL='' dx start quantify --dev
QUANTIFY_REDIS_URL='' dx start quantify --dev
QUANTIFY_DATABASE_URL='mysql://bad' dx start quantify --dev
QUANTIFY_REDIS_URL='http://bad' dx start quantify --dev
QUANTIFY_PORT='99999' dx start quantify --dev
QUANTIFY_DATABASE_URL="$DATABASE_URL" dx start quantify --dev
QUANTIFY_APP_SECRET='' dx start quantify --dev
QUANTIFY_JWT_SECRET='' dx start quantify --dev
```

Expected:

- first command fails with `quantify database url is required`
- second command fails with `quantify redis url is required`
- third command fails with `quantify database url must be postgres`
- fourth command fails with `quantify redis url must be redis`
- fifth command fails with `quantify port must be a valid tcp port`
- sixth command fails with `quantify database must not equal backend database`
- seventh/eighth commands fail with missing secret errors

- [ ] **Step 3: Commit verification-related adjustments if needed**

```bash
git diff --quiet && echo "no changes to commit" || (git add -A && git commit -m "test: finalize quantify engineering integration")
```
