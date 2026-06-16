# React State/Effect Sync Fix Implementation Plan

**Goal:** Clear `apps/front` `no-adjust-state-on-prop-change` errors for issue #2514 without changing chart, auth, or AI Quant user-visible behavior.
**Track:** B
**Issue:** #2514

## Files

- Modify `apps/front/src/app/[lng]/auth/telegram/callback/TelegramCallbackPageClient.tsx`
- Modify `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
- Modify `apps/front/src/components/trading/center-chart-panel/TradingViewLightweightChart.tsx`
- Modify `apps/front/src/components/tradingview/TradingViewChart.tsx`
- Modify focused front tests if existing behavior needs regression coverage

## Steps

1. Reproduce diagnostics.
   - Run React Doctor with the issue command.
   - Extract `no-adjust-state-on-prop-change` entries under `apps/front` and map them to concrete effects.

2. Fix auth callback state sync.
   - Keep network/auth side effects in effects.
   - Avoid using effect only to mirror query-derived or prop-derived values.
   - Add or update focused tests only if behavior is already covered in front unit tests.

3. Fix AI Quant page derived UI state.
   - Derive default active conversation from `conversations` during render or state transitions instead of a catch-up effect.
   - Replace deploy exchange/account sync effects with guarded render-time previous-value correction or event-driven setters where needed.
   - Move tab reset into conversation-changing actions when possible; otherwise use a render guard keyed by active conversation.

4. Fix Quant chat draft sync.
   - Replace `paramValues` -> draft mirroring effect with a previous-prop render guard so draft resets happen in the same render pass.
   - Preserve user edits and existing confirm/cancel behavior.

5. Fix chart diagnostics conservatively.
   - Preserve third-party instance creation, subscription, and cleanup effects.
   - For header/overlay state that mirrors props or latest data, derive render values with `useMemo` or previous-value render guards.
   - Do not rewrite TradingView/lightweight-charts lifecycle integration.

6. Verify.
   - Run React Doctor command and confirm `apps/front` `no-adjust-state-on-prop-change` count is `0`.
   - Run `dx lint`.
   - Run `dx build front --dev`.
   - Run `dx test unit front` unless blocked by time/tooling; if focused tests are used, document exact reason in PR body.

## Commit

- Commit title: `fix: 收敛前端 state effect 同步`
- Commit body references `Closes: #2514` if all acceptance criteria pass.

