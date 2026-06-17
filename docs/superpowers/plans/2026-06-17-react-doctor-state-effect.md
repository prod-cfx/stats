# React Doctor State & Effects Implementation Plan

**Goal:** 收敛 issue #2609 标记的前端局部 state/effect 结构，保持用户可见行为不变。
**Track:** B
**Issue:** #2609

## Files

- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.tsx`
- Modify: `apps/front/src/components/dashboard/AddWidgetModal.tsx`
- Add: `.omc/plans/react-doctor-state-effect-critic-round1.md`

## Steps

1. Issue Gate
   - Verify issue #2609 contains Background / Goal / Plan / Acceptance Criteria.
   - Update issue plan section with this plan path.

2. `AiQuantPageClient`
   - Replace deployment detail/status/action/dialog/error scatter state with one `deploymentUi` object state.
   - Replace guest plaza templates/loading/error/pending scatter state with one `guestPlazaState` object state.
   - Keep existing API calls, routing, dialog props, and text keys unchanged.

3. `AiQuantPlazaPageClient`
   - Derive `returnHref` from `defaultReturnHref` with `useMemo` instead of effect-derived state.
   - Replace template loading state with one `templateState` object.
   - Replace run/edit action state with one `actionState` object.
   - Keep login intent, OKX demo redirect, existing-strategy dialog, and navigation behavior unchanged.

4. `BacktestReportClient`
   - Replace `detailedReport` plus `detailedReportState` with one discriminated state object.
   - Preserve initial report, no-report idle, loading, and error display branches.
   - Keep `startTransition` around async state completion.

5. `AddWidgetModal`
   - Replace `lastOpenState` render-state tracking with `useRef`.
   - Keep modal loading timer, group selection, widget configuration, and save flow unchanged.

## Verify

- `react-doctor apps/front --full --offline --json --fail-on none`
- `dx lint`
- `dx build front --dev`
- `dx test unit front`

## Commit

- Commit title: `refactor: 收敛 React Doctor state effect 结构`
- Commit footer: `Refs: #2609`
