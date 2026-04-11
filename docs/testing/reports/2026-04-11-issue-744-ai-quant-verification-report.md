# Issue #744 AI Quant Verification Report

## Scope

- Task lane: worker-3 verification / review / documentation.
- Plan target:
  - backend/contracts: quantify session/message proxy 503 investigation
  - front: `/meta/market-data-catalog` 404 cleanup + clarification copy/i18n cleanup
  - verification: focused tests + staging replay evidence + remaining risks
- Baseline commit reviewed in this worker worktree: `d3216188`.

## Key review findings

### Already covered by focused unit tests on this baseline

1. **Backend proxy/client contract tests are green.**
   - `apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts`
   - `apps/backend/src/modules/ai-quant-proxy/clients/quantify-ai-quant-client.spec.ts`
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

### Source-level mismatches still visible on this baseline

1. **Front still calls the stale market-data catalog path.**
   - `apps/front/src/lib/api.ts:3144`
   - Current code still fetches `${API_BASE_URL}/meta/market-data-catalog` and silently falls back to local catalog data on failure.
2. **Chinese clarification submit/input copy is not fully localized on this baseline.**
   - `apps/front/src/components/ai-quant/ClarificationGateCard.tsx:55-67`
   - `apps/front/public/locales/zh/common.json`
   - `apps/front/public/locales/en/common.json`
   - Locale bundles define `aiQuant.clarificationGateTitle`, but do not define `clarificationGateInputPlaceholder` or `clarificationGateSubmit`, so the UI falls back to English defaults (`Enter your answer`, `Submit`).

## Staging replay / network evidence

### Public front page

- `curl -sS -D ... https://cfx-www-staging.devbase.cloud/zh/ai-quant`
- Result: `HTTP/2 200`
- Evidence: staging front is reachable and serves the AI Quant page shell.

### Quantify capabilities probe

- `curl -sS -D ... -H "X-Request-Id: issue-744-worker3-1775904928" https://cfx-quantify-staging.devbase.cloud/api/v1/backtesting/capabilities`
- Result: `HTTP/1.1 502 Bad Gateway`
- Body: raw tengine HTML 502 page, no structured JSON error envelope.

### Quantify codegen-session probe

- `curl -sS -D ... -H "X-Request-Id: issue-744-worker3-msg-1775904941" -H 'Content-Type: application/json' -X POST https://cfx-quantify-staging.devbase.cloud/api/v1/llm-strategy-codegen/sessions -d '{"initialMessage":"请生成一个基础的 BTC 15m 趋势策略"}'`
- Result: `HTTP/1.1 502 Bad Gateway`
- Body: raw tengine HTML 502 page, no structured JSON error envelope.

### Interpretation

- Real staging replay is currently blocked before authenticated flow validation: the public quantify staging host is returning naked upstream 502 responses even for basic probes.
- Because the response is HTML instead of the expected structured API envelope, this environment currently cannot verify whether the issue-744 backend proxy fix restores `code + stage + requestId` semantics end-to-end.

## Focused verification evidence

### Jest

1. Front:
   - `/data/stats/node_modules/.bin/jest --config apps/front/jest.config.ts --runTestsByPath apps/front/src/components/ai-quant/ClarificationGateCard.test.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.codegen-confirmation.test.tsx`
   - Result: **PASS** (`2` suites, `21` tests)
2. Backend:
   - `/data/stats/node_modules/.bin/jest --config apps/backend/jest-unit.json --runTestsByPath apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts apps/backend/src/modules/ai-quant-proxy/clients/quantify-ai-quant-client.spec.ts apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts apps/backend/src/modules/ai-quant-proxy/llm-strategy-codegen.controller.spec.ts apps/backend/src/modules/ai-quant-proxy/account-ai-quant-conversations.controller.spec.ts`
   - Result: **PASS** (`5` suites, `45` tests)
3. Quantify:
   - `/data/stats/node_modules/.bin/jest --config apps/quantify/jest-unit.json --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/account-ai-quant-conversations.controller.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
   - Result: **PASS** (`3` suites, `63` tests)

### ESLint

- `/data/stats/node_modules/.bin/eslint --config eslint.config.js ...`
- Result: **FAIL (pre-existing)**
- Relevant failures:
  - `apps/backend/src/modules/ai-quant-proxy/clients/quantify-ai-quant.client.ts` — `ts/consistent-type-imports`
  - `apps/front/src/components/ai-quant/QuantChatPanel.tsx` — import order
  - `apps/front/src/lib/api.ts` — type import / use-before-define / unused helper

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

1. **Staging validation remains blocked by upstream 502s.** Even if the code fix lands cleanly, real replay cannot pass until the public quantify staging host stops returning raw HTML 502 responses.
2. **Front catalog-path fix still needs direct verification after integration.** Current baseline source still points at `/meta/market-data-catalog`.
3. **Clarification-copy fix still needs direct zh locale verification after integration.** Current baseline locale bundle still lacks submit/input clarification keys.
4. **Repo-wide lint/typecheck debt can mask regressions.** The focused AI Quant tests are useful, but full-app validation is currently noisy and not yet a clean release gate.

## Recommended next verification on the leader-integrated branch

1. Re-run the same focused Jest packs above.
2. Re-run a targeted ESLint pass on the touched AI Quant front/backend/quantify files.
3. Re-check the integrated source for removal/replacement of `/meta/market-data-catalog` and for added zh/en clarification submit/input keys.
4. Retry staging probes; if the public quantify host stops returning raw 502 HTML, run the authenticated checklist in `docs/ai-quant-staging-e2e-checklist.md`.
