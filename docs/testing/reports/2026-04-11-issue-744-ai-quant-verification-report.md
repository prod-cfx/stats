# Issue #744 AI Quant Verification Report

## Scope

- Task lane: worker-3 verification / review / documentation.
- Plan target:
  - backend/contracts: quantify session/message proxy 503 investigation
  - front: `/meta/market-data-catalog` 404 cleanup + clarification copy/i18n cleanup
  - verification: focused tests + staging replay evidence + remaining risks
- Baseline commit reviewed in this worker worktree: `ae14ceb8` (`Keep clarification-gate regression coverage aligned with the real freeform flow`).

## Key review findings

### Already covered by focused unit tests on this baseline

1. **Backend proxy/client contract tests are green.**
   - `apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts`
   - `apps/backend/src/modules/ai-quant-proxy/clients/quantify-ai-quant-client.spec.ts`
   - `apps/backend/src/modules/ai-quant-proxy/clients/backend-contract-responses.spec.ts`
   - `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts`
   - `apps/backend/src/modules/ai-quant-proxy/llm-strategy-codegen.controller.spec.ts`
   - `apps/backend/src/modules/ai-quant-proxy/account-ai-quant-conversations.controller.spec.ts`
2. **Quantify conversation + clarification behavior is green at the service/controller level.**
   - `apps/quantify/src/modules/llm-strategy-codegen/account-ai-quant-conversations.controller.spec.ts`
   - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
   - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
3. **Front clarification UX tests are green.**
   - `apps/front/src/components/ai-quant/ClarificationGateCard.test.tsx`
   - `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.codegen-confirmation.test.tsx`
   - These cover structured clarification answers, free-form clarification answers, blocked confirm state, and published-session backtest enablement.

### Source-level spot checks on this branch

1. **The stale front market-data catalog fetch has been removed on this branch.**
   - `apps/front/src/lib/api.ts:3086-3094`
   - `fetchMarketDataCatalogItems()` now serves the fallback catalog directly via `cachedRequest(...)` and no longer calls `/meta/market-data-catalog`.
2. **Clarification input / submit copy is now present in both locale bundles.**
   - `apps/front/public/locales/en/common.json`
   - `apps/front/public/locales/zh/common.json`
   - Spot check confirms both `clarificationGateInputPlaceholder` and `clarificationGateSubmit` exist on the integrated branch.

## Staging replay / network evidence

### Environment gate

- Target env: `staging`
- `.env.staging`: present
- `.env.staging.local`: present

### Authenticated backend proxy reads are healthy

1. `GET https://cfx-backend-staging.devbase.cloud/api/v1/account/ai-quant/conversations`
   - Result: `HTTP 200`
   - Evidence: returns real conversation records including `activeCodegenSessionId`, `clarificationGate`, `publishedSnapshotId`, and `strategyInstanceId` fields.
2. `GET https://cfx-backend-staging.devbase.cloud/api/v1/account/ai-quant/strategies?limit=3&page=1`
   - Result: `HTTP 200`
   - Evidence: returns real strategy list items with `paramSchema` / `paramValues`.
3. `GET https://cfx-backend-staging.devbase.cloud/api/v1/backtesting/capabilities`
   - Result: `HTTP 200`
   - Evidence: backtesting capability proxy is reachable through staging backend.

### Authenticated codegen-session / message probes now return structured backend envelopes

1. `POST /api/v1/llm-strategy-codegen/sessions`
   - Result: `HTTP 503`
   - Error envelope:
     - `error.code = SERVICE_TEMPORARILY_UNAVAILABLE`
     - `error.requestId = issue-744-worker3-codegen-start-1775912542143`
     - `error.args.reasonMessage = 量化服务暂时不可用，请稍后重试`
2. `GET /api/v1/llm-strategy-codegen/sessions/cmnuch5mi3ypw1sqs0vfjir85`
   - Result: `HTTP 503`
   - Error envelope:
     - `error.code = SERVICE_TEMPORARILY_UNAVAILABLE`
     - `error.requestId = issue-744-worker3-get-session-1775912608584`
     - `error.args.upstreamCode = UPSTREAM_REQUEST_FAILED`
3. `POST /api/v1/llm-strategy-codegen/sessions/cmnuch5mi3ypw1sqs0vfjir85/messages` without `confirmedCanonicalDigest`
   - Result: `HTTP 400`
   - Error envelope:
     - `error.code = BAD_REQUEST`
     - `error.requestId = issue-744-worker3-continue-with-clarification-1775912608667`
     - `error.args.expectedCanonicalDigest = sha256:49f25c6d04701569844a932032aa0c772bfea53714a91a75b1bb9748e6396388`
4. `POST /api/v1/llm-strategy-codegen/sessions/cmnuch5mi3ypw1sqs0vfjir85/messages` with the expected digest
   - Result: `HTTP 503`
   - Error envelope:
     - `error.code = SERVICE_TEMPORARILY_UNAVAILABLE`
     - `error.requestId = issue-744-worker3-confirmed-1775912622340`
     - `error.args.upstreamCode = UPSTREAM_REQUEST_FAILED`

### Deploy prerequisites on staging are still not met for this user

- `GET /api/v1/account/exchange-accounts`
- Result: `HTTP 200`, but returned `0` accounts for the authenticated staging user.
- Impact: even with a published snapshot, this account cannot complete the deploy leg of the real flow until an exchange account is linked.

### Interpretation

- **The backend proxy now preserves structured JSON error envelopes for the affected session/message paths.** The staging backend returned `error.code + requestId + structured args` for start/get/continue probes instead of a naked HTML upstream failure.
- **Inference:** the `POST /sessions` probe returned `503`, but the subsequent conversations list showed a new `DRAFTING` conversation created at the same time with an `activeCodegenSessionId`. This suggests the upstream created draft state before the proxy surfaced the availability failure, so the remaining staging problem appears to be runtime availability rather than response-shape validation.
- A full end-to-end publish → backtest → deploy run is still blocked by staging runtime availability (`503` on session/message fetch/confirm) plus the absence of linked exchange accounts on the authenticated staging user.

## Focused verification evidence

### Jest

1. Front:
   - `/data/stats/node_modules/.bin/jest --config apps/front/jest.config.ts --runTestsByPath apps/front/src/components/ai-quant/ClarificationGateCard.test.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.codegen-confirmation.test.tsx`
   - Result: **PASS** (`2` suites, `22` tests)
2. Backend:
   - `/data/stats/node_modules/.bin/jest --config apps/backend/jest-unit.json --runTestsByPath apps/backend/src/modules/ai-quant-proxy/clients/backend-contract-responses.spec.ts apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts apps/backend/src/modules/ai-quant-proxy/clients/quantify-ai-quant-client.spec.ts apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts apps/backend/src/modules/ai-quant-proxy/llm-strategy-codegen.controller.spec.ts apps/backend/src/modules/ai-quant-proxy/account-ai-quant-conversations.controller.spec.ts`
   - Result: **PASS** (`6` suites, `47` tests)
3. Quantify:
   - `/data/stats/node_modules/.bin/jest --config apps/quantify/jest-unit.json --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/account-ai-quant-conversations.controller.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
   - Result: **PASS** (`3` suites, `63` tests)

### ESLint

- `/data/stats/node_modules/.bin/eslint --config eslint.config.js ...`
- Result: **FAIL (pre-existing)**
- Relevant failures:
  - `apps/backend/src/modules/ai-quant-proxy/clients/quantify-ai-quant-client.spec.ts` — `no-new` side-effect construction in existing spec setup
  - `packages/api-contracts/src/generated/backend.ts` / `packages/api-contracts/src/generated/quantify.ts` — ignored by ESLint config (warnings only)

### TypeScript

1. Front:
   - `/data/stats/node_modules/.bin/tsc --noEmit --project apps/front/tsconfig.json`
   - Result: **FAIL (environment / repo-wide pre-existing)**
   - Representative errors: missing `next/*`, `lucide-react`, `recharts`, `socket.io-client`, `@ai/api-contracts`
2. Backend:
   - `/data/stats/node_modules/.bin/tsc --noEmit --project apps/backend/tsconfig.json`
   - Result: **FAIL (repo-wide pre-existing)**
   - Representative errors: missing generated Prisma types, missing `@zodios/core`, unrelated admin/whale-notification type errors
3. Quantify:
   - `/data/stats/node_modules/.bin/tsc --noEmit --project apps/quantify/tsconfig.json`
   - Result: **FAIL (repo-wide pre-existing)**
   - Representative errors: missing generated Prisma types and unrelated existing service typing failures

## Remaining risks for the integrated branch

1. **Staging runtime availability still blocks a full real flow.** The backend proxy now returns structured envelopes, but authenticated codegen session read/confirm still hits `503 SERVICE_TEMPORARILY_UNAVAILABLE`.
2. **This staging user has no linked exchange accounts.** Deploy verification cannot complete until at least one staging exchange account exists for the authenticated user.
3. **Repo-wide lint/typecheck debt can mask regressions.** The focused AI Quant tests are useful, but full-app validation is currently noisy and not yet a clean release gate.

## Recommended next verification on the leader-integrated branch

1. Re-run the same focused Jest packs above.
2. Re-run a targeted ESLint pass on the touched AI Quant front/backend/quantify files.
3. Retry the authenticated staging checklist in `docs/ai-quant-staging-e2e-checklist.md` after quantify availability stabilizes and after an exchange account is linked for the staging user.

## Current-head closeout rerun on this worker worktree

Closeout rerun target:
- Current integrated head reviewed here: `81d37fd82d37aaa0670373f0655638bd734a8def`
- Deploy parity note: `gh run view 24283847133` reports deployed head `3e237307ea16f1b114695ce623f2c4f2b7f0a1a4`, and `git diff --name-only 3e237307..81d37fd8` only reports the staging deploy report markdown file.

### Fresh verification results

1. **Deploy CI metadata**
   - `gh run view 24283847133 --json databaseId,headSha,displayTitle,status,conclusion,jobs,url`
   - Result: **PASS** — workflow `CI` concluded `success`; jobs `deploy-front`, `deploy-admin`, `deploy-backend`, and `deploy-quantify` all concluded `success`.
2. **Front focused Jest**
   - `/data/stats/node_modules/.bin/jest --config apps/front/jest.config.ts --runTestsByPath apps/front/src/components/ai-quant/ClarificationGateCard.test.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.codegen-confirmation.test.tsx --runInBand`
   - Result: **PASS** (`2` suites, `22` tests)
3. **Quantify focused Jest**
   - `/data/stats/node_modules/.bin/jest --config apps/quantify/jest-unit.json --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/account-ai-quant-conversations.controller.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts --runInBand`
   - Result: **PASS** (`3` suites, `63` tests)
4. **Backend focused Jest**
   - `/data/stats/node_modules/.bin/jest --config apps/backend/jest-unit.json --runTestsByPath apps/backend/src/modules/ai-quant-proxy/clients/backend-contract-responses.spec.ts apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts apps/backend/src/modules/ai-quant-proxy/clients/quantify-ai-quant-client.spec.ts apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts apps/backend/src/modules/ai-quant-proxy/llm-strategy-codegen.controller.spec.ts apps/backend/src/modules/ai-quant-proxy/account-ai-quant-conversations.controller.spec.ts --runInBand`
   - Result: **FAIL**
   - New observed failure on the integrated head: `quantify-ai-quant-client.spec.ts` now expects timeout normalization to preserve `message: "Quantify request failed"` and `args.cause: "timeout after 1000ms"`, but the current received error has `args.cause: "{}"` and no matching message field in the assertion output.
   - Interpretation: the branch still carries a backend-side test regression in timeout error normalization, even though the staging runtime/deploy evidence for issue #744 is documented separately.
5. **Project typecheck**
   - `/data/stats/node_modules/.bin/tsc --noEmit --project apps/front/tsconfig.json`
   - `/data/stats/node_modules/.bin/tsc --noEmit --project apps/backend/tsconfig.json`
   - `/data/stats/node_modules/.bin/tsc --noEmit --project apps/quantify/tsconfig.json`
   - Result: **FAIL (pre-existing repo/worktree debt)**
   - Representative front failures: missing `next/*`, `lucide-react`, `recharts`, `react-markdown`, `remark-gfm`
   - Representative backend failures: unrelated `admin-menu.service.ts`, `whale-notification-*`, missing generated Prisma / `@zodios/core`
   - Representative quantify failures: missing generated Prisma types plus unrelated `account-strategy-view` / `strategy-instances` typing failures
6. **Diff hygiene**
   - `git diff --check`
   - Result: **PASS**
