# Mobile AI Quant New Session Isolation Design

## Background

Flutter mobile AI Quant can reopen an old conversation that already has a published codegen session. In the tested flow, the user entered a new EMA20/60/144 strategy, but the confirm/backtest/deploy wizard continued to use the previous ETHUSDT strategy snapshot. This happens because mobile keeps the active conversation and its published codegen metadata unless the user successfully creates and switches to a fresh session or the app invalidates stale publication state on a new strategy message.

## Goal

Make mobile create and use an isolated codegen session for a new strategy request, so the confirm wizard consumes the latest strategy instead of a stale published snapshot. The deploy flow should stay backend-compatible and must not change front or backend contracts.

## Scope

- Only `apps/quantify-mobile` changes.
- Use existing `AiChatRepository` / `packages/api-contracts-dart` paths.
- No backend changes.
- Focus on session isolation and stale publication invalidation. Deployment preflight failures are recorded separately.

## Design

### New Session Action

When the user taps the AI header new-session button:

- Call `AiChatRepository.createSession`.
- Insert the returned session at the top of mobile state.
- Set it as `currentId`.
- Clear the text input and that session's draft.
- Stop any current streaming/timer state.

If the backend returns a codegen session with no messages, mobile should render it as an empty/new conversation instead of leaving the old conversation visible.

### New Strategy Message In Old Published Conversation

When the user sends a non-confirmation strategy prompt in a conversation that already has published or deploy-related state, mobile must prevent stale reuse:

- Clear `deployedTo` for local flow gating.
- Clear draft-only publication metadata that points at the previous strategy when the model supports it.
- Ensure the next assistant reply's `codegenSessionId` becomes the source of truth for the confirm CTA.

Because current mobile models expose fewer publication fields than front, the safe minimum is to make `_latestConfirmableTurn` prefer the latest assistant turn's own `codegenSessionId` and not fall back to the session-level `llmCodegenSessionId` when the latest assistant turn lacks codegen metadata.

### Confirm Intent Handling

Typing `确认策略` should open `/ai/confirm` only when the latest assistant turn is confirmable. If no confirmable assistant turn exists yet, mobile should not append a normal user message. It should show an inline assistant/system hint telling the user to wait for strategy analysis or tap the visible confirm button.

### Tests

Add widget/controller tests for:

- `createSession` switches `currentId` to the new backend session and clears drafts.
- Latest assistant turn without codegen metadata is not treated as confirmable by falling back to stale session metadata.
- Sending `确认策略` with a visible confirm card opens confirm; sending it without a confirmable assistant does not append a normal user turn.

## Out Of Scope

- Deployment account binding and balance preflight fixes.
- Backend codegen session lifecycle changes.
- Front AI Quant behavior.
