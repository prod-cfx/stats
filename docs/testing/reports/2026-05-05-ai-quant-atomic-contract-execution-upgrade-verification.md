# AI Quant atomic contract execution upgrade verification

日期：2026-05-06
Issue：#960
范围：conversation guardrails、atomic contract projection/backtest/runtime parity、AI Quant 前端 display graph 保存与展示、deploy guard、target build。

## Scope

- 后端会话级 guardrail：覆盖三条真实中文组合策略，确保不会提前进入 `unsupportedFallback` / “是否改用”替代策略推荐。
- 前端 display graph：确保 codegen 响应中 server `displayLogicGraph` 的“成交量高于过去 20 根均量的 1.5 倍”保留到 conversation state 并显示在页面上，不被 legacy fallback 覆盖。
- deploy guard：确认 atomic display graph 只作为展示层，不进入 deploy payload，也不改变发布快照真相字段。
- 验证命令：按 Task 10 指定的 targeted unit/build/diff 命令执行并记录结果。

## Target commands and results

| Command | Result | Notes |
| --- | --- | --- |
| `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts` | PASS | 9 passed |
| `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-canonical-ir.spec.ts` | PASS | 5 passed |
| `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts` | PASS | 3 passed |
| `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts` | PASS | 1 passed |
| `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts` | PASS | 48 passed |
| `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "keeps supported atomic conversation"` | PASS | 3 passed, 226 skipped |
| `dx test unit front AiQuantPageClient.test.tsx` | PASS | 28 passed |
| `dx test unit front AiQuantPageClient.deploy-guard.test.tsx` | PASS | 13 passed |
| `dx test unit front ai-quant-page-conversation.test.ts` | PASS | 61 passed |
| `dx build quantify --dev` | PASS | `quantify:prisma:generate` ran; `quantify:build` completed, some dependencies came from Nx cache |
| `dx build contracts --dev` | FAIL | Blocked before contracts generation: current Node is `v20.18.0`, project wants `>=20.19.0`; `backend:swagger` also failed because `apps/backend/src/prisma/prisma.types.ts` cannot resolve `../../generated/prisma` |
| `git diff --check` | PASS | No whitespace errors |

## Development-only diagnostic reruns

- Initial backend guardrail run failed after adding the test because the assertion expected legacy keys (`bollinger.touch_lower`, `indicator.above`) while the current supported atomic path correctly emits generic atomic keys (`price.detect.indicator_boundary`, `condition.expression`). The test was updated to assert supported atomic semantics instead of old aliases, then passed.
- Initial frontend path-specific runs using `apps/front/src/app/[lng]/...` failed with “No tests found” because Jest treated `[lng]` as a regex character class. The same tests were rerun successfully by basename (`AiQuantPageClient.test.tsx`, `AiQuantPageClient.deploy-guard.test.tsx`).

## Guardrail coverage added

- Conversation messages covered:
  - `ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。`
  - `ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈`
  - `BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。`
- Assertions avoid brittle copy checks except the explicit guard that assistant prompt does not contain `是否改用`.
- Assertions verify `unsupportedFallback` remains null/undefined and the persisted semantic state has supported trigger/risk atoms without `recognized_unsupported` support markers.
- Frontend state/page assertion verifies server `displayLogicGraph` keeps the atomic volume text and removes stale “不支持的条件” display text.
- Deploy guard assertion verifies deploy still submits `publishedSnapshotId` and selected account truth, and display graph text is absent from the deploy payload.

## Known environment limitations

- `dx build contracts --dev` is not green in this worktree because the local runtime is Node `v20.18.0`, below the repo baseline `>=20.19.0`, and backend generated Prisma client is absent for swagger compilation.
- The failing contracts command stopped at `backend:swagger`, before `quantify:swagger` and contract generation scripts could run.
